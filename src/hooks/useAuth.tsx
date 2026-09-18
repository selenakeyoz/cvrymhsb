import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "yonetici" | "garson" | "mutfak" | "muhasebe";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadProfile = async (uid: string) => {
      const [{ data: roleRows }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("username").eq("id", uid).maybeSingle(),
      ]);
      if (!active) return;
      setRoles(((roleRows ?? []) as { role: Role }[]).map((r) => r.role));
      setUsername(profile?.username ?? null);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) void loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) void loadProfile(s.user.id);
      else {
        setRoles([]);
        setUsername(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const hasRole = (r: Role) => roles.includes(r);
  const isAdmin = roles.includes("yonetici");
  const canSee = (r: Role) => isAdmin || roles.includes(r);

  return { session, user, roles, username, loading, hasRole, isAdmin, canSee };
}
