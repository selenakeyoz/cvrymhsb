import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NetworkGate } from "@/components/NetworkGate";
import { setupStatus, createFirstAdmin, usernameToEmail } from "@/lib/admin.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Adisyon Girişi | Restoran Otomasyonu" },
      {
        name: "description",
        content:
          "Restoran sipariş, adisyon, mutfak ve muhasebe otomasyonu için personel giriş ekranı.",
      },
      { property: "og:title", content: "Adisyon Girişi | Restoran Otomasyonu" },
      {
        property: "og:description",
        content: "Katlar, mutfak ve muhasebe ekranlarına güvenli personel girişi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const status = useServerFn(setupStatus);
  const createAdmin = useServerFn(createFirstAdmin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: setup, refetch } = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => status(),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/katlar", replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (setup?.needsSetup) {
        await createAdmin({ data: { username, password } });
        toast.success("Yönetici hesabı oluşturuldu, giriş yapılıyor...");
        await refetch();
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });
      if (error) throw new Error("Kullanıcı adı veya şifre hatalı.");
      navigate({ to: "/katlar", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <NetworkGate>
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="panel w-full max-w-sm p-8">
          <div className="mb-8 text-center">
            <p className="font-display text-4xl leading-none text-primary">ADİSYON</p>
            <p className="mt-2 text-xs tracking-[0.3em] text-muted-foreground">
              RESTORAN OTOMASYONU
            </p>
          </div>

          {setup?.needsSetup && (
            <div className="mb-6 flex gap-3 rounded-md border border-primary/40 bg-primary/10 p-3 text-xs">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                İlk kurulum: buradan oluşturduğunuz hesap yönetici olur. Diğer personeli
                Yönetim sayfasından eklersiniz.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">Kullanıcı adı</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              {setup?.needsSetup ? "Yöneticiyi oluştur ve gir" : busy ? "Giriş yapılıyor..." : "Giriş yap"}
            </button>
          </form>
        </div>
      </div>
    </NetworkGate>
  );
}
