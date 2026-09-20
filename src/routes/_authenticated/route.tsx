import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  LayoutGrid,
  ChefHat,
  Calculator,
  Settings,
  LogOut,
  Menu as MenuIcon,
  X,
  Lock,
} from "lucide-react";
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
  { to: "/mutfak", label: "Mutfak & Menü", icon: ChefHat, role: "mutfak" },
  { to: "/muhasebe", label: "Muhasebe", icon: Calculator, role: "muhasebe" },
  { to: "/yonetim", label: "Yönetim", icon: Settings, role: "yonetici" },
];

function AuthenticatedLayout() {
  const { username, roles, canSee, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  const items = NAV.filter((n) => loading || canSee(n.role));
  const current = NAV.find((n) => pathname.startsWith(n.to));
  const allowed = loading || !current || canSee(current.role);

  const sidebar = (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-start justify-between px-5 py-6">
        <p className="font-display text-2xl leading-none text-sidebar-primary">ADİSYON</p>
        <button
          onClick={() => setOpen(false)}
          className="rounded p-1 hover:bg-sidebar-accent md:hidden"
          aria-label="Menüyü kapat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            activeProps={{
              className:
                "flex items-center gap-3 rounded-md px-3 py-3 text-sm bg-sidebar-primary text-sidebar-primary-foreground font-semibold",
            }}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <p className="truncate text-sm font-semibold">{username ?? "..."}</p>
        <p className="truncate text-xs text-muted-foreground">
          {roles.map((r) => ROLE_LABELS[r]).join(", ") || "Rol atanmadı"}
        </p>
        <button
          onClick={signOut}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-border px-3 py-2 text-xs transition-colors hover:bg-sidebar-accent"
        >
          <LogOut className="h-3.5 w-3.5" /> Çıkış yap
        </button>
      </div>
    </div>
  );

  return (
    <NetworkGate>
      <div className="flex min-h-[100dvh]">
        <aside className="hidden md:flex">{sidebar}</aside>

        {open && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="absolute inset-0 bg-background/80" onClick={() => setOpen(false)} />
            <div className="relative z-10 h-full">{sidebar}</div>
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
          <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
            <button
              onClick={() => setOpen(true)}
              className="rounded-md border border-border p-2"
              aria-label="Menüyü aç"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <p className="font-display text-xl leading-none text-primary">ADİSYON</p>
            <span className="ml-auto truncate text-xs text-muted-foreground">{username ?? ""}</span>
          </header>

          <div className="min-w-0 flex-1">
            {allowed ? (
              <Outlet />
            ) : (
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
                <Lock className="h-8 w-8 text-muted-foreground" />
                <p className="font-display text-2xl">ERİŞİM YOK</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Bu bölüm için yetkiniz yok. Yetkili bir kullanıcı adıyla giriş yapın.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </NetworkGate>
  );
}
