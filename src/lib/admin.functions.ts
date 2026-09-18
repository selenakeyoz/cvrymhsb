import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const ROLES = ["yonetici", "garson", "mutfak", "muhasebe"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  yonetici: "Yönetici",
  garson: "Garson",
  mutfak: "Mutfak",
  muhasebe: "Muhasebe",
};

export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@adisyon.local`;

async function assertAdmin(userId: string, supabase: { rpc: Function }) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "yonetici",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bu işlem için yönetici olmanız gerekir.");
}

/* ---------------- ilk kurulum ---------------- */

export const setupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return { needsSetup: (count ?? 0) === 0 };
});

export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        username: z.string().min(3).max(32),
        password: z.string().min(6).max(72),
        fullName: z.string().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("Kurulum zaten tamamlanmış.");

    const email = usernameToEmail(data.username);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Hesap oluşturulamadı.");

    await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      username: data.username.trim().toLowerCase(),
      full_name: data.fullName ?? null,
    });
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "yonetici" });
    return { ok: true, email };
  });

/* ---------------- personel yönetimi ---------------- */

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, full_name, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role),
    }));
  });

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        username: z.string().min(3).max(32),
        password: z.string().min(6).max(72),
        fullName: z.string().max(80).optional(),
        role: z.enum(ROLES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = usernameToEmail(data.username);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Hesap oluşturulamadı.");
    await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      username: data.username.trim().toLowerCase(),
      full_name: data.fullName ?? null,
    });
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: data.role });
    return { ok: true };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    if (data.userId === context.userId) throw new Error("Kendi hesabınızı silemezsiniz.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- ağ (wifi) izin listesi ---------------- */

export const listAllowedIps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("allowed_ips")
      .select("id, ip, label, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addAllowedIp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ip: z.string().min(3).max(64), label: z.string().max(60).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("allowed_ips")
      .insert({ ip: data.ip.trim(), label: data.label ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeAllowedIp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("allowed_ips").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- gün sonu ---------------- */

export const runClosing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "muhasebe",
    });
    if (error) throw new Error(error.message);
    if (!ok) await assertAdmin(context.userId, context.supabase);
    const { runDailyClosing } = await import("@/lib/closing.server");
    return await runDailyClosing(data.date);
  });
