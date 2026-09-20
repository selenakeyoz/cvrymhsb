import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, ChefHat, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/mutfak")({
  head: () => ({
    meta: [
      { title: "Mutfak & Menü | Adisyon" },
      { name: "description", content: "Katlardan gelen siparişler anlık mutfakta; menü de buradan yönetilir." },
      { property: "og:title", content: "Mutfak & Menü | Adisyon" },
      { property: "og:description", content: "Anlık sipariş akışı, hazırlama takibi ve menü yönetimi." },
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

const money = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

function KitchenPage() {
  const [tab, setTab] = useState<"siparisler" | "menu">("siparisler");

  return (
    <div className="p-4 sm:p-6">
      <h1 className="flex items-center gap-2 font-display text-2xl sm:text-3xl">
        <ChefHat className="h-6 w-6 text-primary sm:h-7 sm:w-7" /> MUTFAK
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Siparişler katlardan anında buraya düşer; menüyü de buradan yönetin.
      </p>

      <div className="mb-6 flex gap-2">
        {(["siparisler", "menu"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2.5 text-sm font-semibold sm:flex-none sm:px-5 ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-accent"
            }`}
          >
            {t === "siparisler" ? "Siparişler" : "Menü"}
          </button>
        ))}
      </div>

      {tab === "siparisler" ? <Orders /> : <MenuManager />}
    </div>
  );
}

function Orders() {
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
    <>
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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Kat {r.floor} · Masa {r.table_no} · {time(r.created_at)}
                    </p>
                    <p className="mt-1 font-semibold">
                      {r.quantity}× {r.item_name}
                    </p>
                    {r.note && <p className="mt-1 text-xs text-muted-foreground">Not: {r.note}</p>}
                  </div>
                  <span className="shrink-0 rounded bg-secondary px-2 py-1 text-[10px] uppercase">
                    {r.status}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  {r.status === "beklemede" && (
                    <button
                      onClick={() => setStatus(r.id, "hazirlaniyor")}
                      className="flex-1 rounded-md border border-border px-3 py-2.5 text-xs hover:bg-accent"
                    >
                      Hazırlamaya başla
                    </button>
                  )}
                  <button
                    onClick={() => setStatus(r.id, "hazir")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground"
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
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2.5 text-sm"
              >
                <span className="text-muted-foreground">
                  Kat {r.floor} · Masa {r.table_no}
                </span>
                <span className="min-w-0 flex-1">
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
    </>
  );
}

function MenuManager() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["menu-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, category, price, is_active, sort_order")
        .order("category")
        .order("sort_order");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const categories = Array.from(new Set(items.map((i) => i.category)));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["menu-all"] });
    qc.invalidateQueries({ queryKey: ["menu-active"] });
  };

  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("menu_items").update({ is_active: !active }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Ürün silindi.");
    refresh();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(price.replace(",", "."));
    if (!name.trim() || Number.isNaN(value)) return toast.error("Ürün adı ve fiyat gerekli.");
    const { error } = await supabase.from("menu_items").insert({
      name: name.trim(),
      category: category.trim() || "Diğer",
      price: value,
    });
    if (error) return toast.error(error.message);
    setName("");
    setPrice("");
    toast.success("Ürün eklendi.");
    refresh();
  };

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Pasif yapılan ürünler katlardaki sipariş ekranında görünmez.
      </p>

      <form onSubmit={add} className="panel mb-8 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Ürün adı</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Kategori</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="kategoriler"
            placeholder="Diğer"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <datalist id="kategoriler">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Fiyat</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Ekle
        </button>
      </form>

      {categories.map((c) => (
        <section key={c} className="mb-6">
          <p className="mb-2 text-sm font-semibold text-primary">{c}</p>
          <ul className="space-y-2">
            {items
              .filter((i) => i.category === c)
              .map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border px-3 py-2.5 text-sm"
                >
                  <span
                    className={`min-w-0 flex-1 ${i.is_active ? "" : "text-muted-foreground line-through"}`}
                  >
                    {i.name}
                  </span>
                  <span className="w-24 text-right">{money(Number(i.price))}</span>
                  <button
                    onClick={() => toggle(i.id, i.is_active)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                      i.is_active
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground"
                    }`}
                  >
                    {i.is_active ? "Aktif" : "Pasif"}
                  </button>
                  <button onClick={() => remove(i.id)} className="rounded p-1 hover:bg-accent">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}
