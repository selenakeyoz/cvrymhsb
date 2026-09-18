import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, ChefHat, BookOpen, Calculator, Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Role } from "@/hooks/useAuth";
import { NetworkGate } from "@/components/NetworkGate";
import { ROLE_LABELS } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const NAV: { to: string; label: string; icon: typeof LayoutGrid; role: Role }[] = [
  { to: "/katlar", label: "Katlar & Masalar", icon: LayoutGrid, role: "garson" },
  { to: "/mutfak", label: "Mutfak", icon: ChefHat, role: "mutfak" },
  { to: "/menu", label: "Menü", icon: BookOpen, role: "mutfak" },
  { to: "/muhasebe", label: "Muhasebe", icon: Calculator, role: "muhasebe" },
  { to: "/yonetim", label: "Yönetim", icon: Settings, role: "yonetici" },
];

function AuthenticatedLayout() {
  const { username, roles, canSee, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  const items = NAV.filter((n) => loading || canSee(n.role));

  return (
    <NetworkGate>
      <div className="flex min-h-screen">
        <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
          <div className="px-5 py-6">
            <p className="font-display text-2xl leading-none text-sidebar-primary">ADİSYON</p>
            <p className="mt-1 text-xs tracking-widest text-muted-foreground">
              RESTORAN OTOMASYONU
            </p>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {items.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                activeProps={{
                  className:
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm bg-sidebar-primary text-sidebar-primary-foreground font-semibold",
                }}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-sidebar-border p-4">
            <p className="text-sm font-semibold">{username ?? "..."}</p>
            <p className="text-xs text-muted-foreground">
              {roles.map((r) => ROLE_LABELS[r]).join(", ") || "Rol atanmadı"}
            </p>
            <button
              onClick={signOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-border px-3 py-2 text-xs transition-colors hover:bg-sidebar-accent"
            >
              <LogOut className="h-3.5 w-3.5" /> Çıkış yap
            </button>
          </div>
        </aside>
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </NetworkGate>
  );
}
