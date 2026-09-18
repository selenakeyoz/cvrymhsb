import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { checkNetworkAccess } from "@/lib/network.functions";

/** Sadece izin verilen ağlardan (restoran wifi çıkış IP'leri) erişime izin verir. */
export function NetworkGate({ children }: { children: ReactNode }) {
  const check = useServerFn(checkNetworkAccess);
  const { data, isLoading } = useQuery({
    queryKey: ["network-access"],
    queryFn: () => check(),
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Ağ kontrol ediliyor...
      </div>
    );
  }

  if (data && !data.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="panel max-w-md p-8 text-center">
          <WifiOff className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h1 className="text-2xl">Bu ağdan giriş yapılamaz</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Bu sisteme yalnızca restoranın izin verilen internet bağlantılarından
            erişilebilir. Lütfen restoran wifi ağına bağlanın.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Bağlantı adresiniz: <span className="font-mono">{data.ip}</span>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
