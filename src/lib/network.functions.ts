import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

function clientIp(): string {
  const req = getRequest();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    "bilinmiyor"
  );
}

/** Ziyaretçinin internet çıkış IP'si izin listesinde mi? Liste boşsa erişim açıktır. */
export const checkNetworkAccess = createServerFn({ method: "GET" }).handler(async () => {
  const ip = clientIp();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("allowed_ips").select("ip");
  if (error) throw new Error(error.message);

  const list = (data ?? []).map((r) => r.ip.trim()).filter(Boolean);
  if (list.length === 0) return { allowed: true, ip, configured: false };

  const allowed = list.some((entry) => {
    if (entry.endsWith(".*")) return ip.startsWith(entry.slice(0, -1));
    return entry === ip;
  });
  return { allowed, ip, configured: true };
});
