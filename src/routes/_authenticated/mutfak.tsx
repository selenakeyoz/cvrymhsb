import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Check, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/mutfak")({
  head: () => ({
    meta: [
      { title: "Mutfak Ekranı | Adisyon" },
      { name: "description", content: "Katlardan gelen siparişler anlık olarak mutfak ekranında." },
      { property: "og:title", content: "Mutfak Ekranı | Adisyon" },
      { property: "og:description", content: "Anlık sipariş akışı ve hazırlama takibi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KitchenPage,
});

type Row = {
  id: string;
  floor: number;
  table_no: number;
  item_name: string;
  quantity: number;
  status: string;
  note: string | null;
  created_at: string;
};

function KitchenPage() {
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["kitchen-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, floor, table_no, item_name, quantity, status, note, created_at")
        .is("check_id", null)
        .in("status", ["beklemede", "hazirlaniyor", "hazir"])
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("orders-kitchen")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("order_items").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
  };

  const waiting = rows.filter((r) => r.status !== "hazir");
  const ready = rows.filter((r) => r.status === "hazir");

  const time = (iso: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  return (
    <div className="p-6">
      <h1 className="flex items-center gap-2 font-display text-3xl">
        <ChefHat className="h-7 w-7 text-primary" /> MUTFAK
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Siparişler katlardan anında buraya düşer.
      </p>

      <section className="mb-8">
        <p className="mb-3 text-xs tracking-widest text-muted-foreground">
          HAZIRLANACAK ({waiting.length})
        </p>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bekleyen sipariş yok.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {waiting.map((r) => (
              <div key={r.id} className="panel p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Kat {r.floor} · Masa {r.table_no} · {time(r.created_at)}
                    </p>
                    <p className="mt-1 font-semibold">
                      {r.quantity}× {r.item_name}
                    </p>
                    {r.note && <p className="mt-1 text-xs text-muted-foreground">Not: {r.note}</p>}
                  </div>
                  <span className="rounded bg-secondary px-2 py-1 text-[10px] uppercase">
                    {r.status}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  {r.status === "beklemede" && (
                    <button
                      onClick={() => setStatus(r.id, "hazirlaniyor")}
                      className="flex-1 rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"
                    >
                      Hazırlamaya başla
                    </button>
                  )}
                  <button
                    onClick={() => setStatus(r.id, "hazir")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    <Check className="h-3.5 w-3.5" /> Tamamla
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="mb-3 text-xs tracking-widest text-muted-foreground">
          HAZIR — SERVİS BEKLİYOR ({ready.length})
        </p>
        {ready.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hazır sipariş yok.</p>
        ) : (
          <ul className="space-y-2">
            {ready.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Kat {r.floor} · Masa {r.table_no}
                </span>
                <span className="flex-1">
                  {r.quantity}× {r.item_name}
                </span>
                <button
                  onClick={() => setStatus(r.id, "hazirlaniyor")}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                >
                  Geri al
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
