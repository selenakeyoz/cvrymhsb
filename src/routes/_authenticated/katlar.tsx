import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Plus, Minus, Trash2, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/katlar")({
  head: () => ({
    meta: [
      { title: "Katlar & Masalar | Adisyon" },
      { name: "description", content: "Üç kat, her katta 20 masa: sipariş alma ve hesap kapatma." },
      { property: "og:title", content: "Katlar & Masalar | Adisyon" },
      { property: "og:description", content: "Masalara sipariş ekleyin, hesabı kapatın." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FloorsPage,
});

const FLOORS = [1, 2, 3];
const TABLES = Array.from({ length: 20 }, (_, i) => i + 1);
const PAYMENTS = ["nakit", "kart", "havale"] as const;

const money = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

type OrderRow = {
  id: string;
  floor: number;
  table_no: number;
  item_name: string;
  unit_price: number;
  quantity: number;
  status: string;
  note: string | null;
};

function FloorsPage() {
  const qc = useQueryClient();
  const [floor, setFloor] = useState(1);
  const [table, setTable] = useState<number | null>(null);

  const { data: openOrders = [] } = useQuery({
    queryKey: ["open-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, floor, table_no, item_name, unit_price, quantity, status, note")
        .is("check_id", null)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as OrderRow[];
    },
  });

  const { data: menu = [] } = useQuery({
    queryKey: ["menu-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, category, price, is_active, sort_order")
        .eq("is_active", true)
        .order("category")
        .order("sort_order");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("orders-floors")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        qc.invalidateQueries({ queryKey: ["open-orders"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const totalOf = (f: number, t: number) =>
    openOrders
      .filter((o) => o.floor === f && o.table_no === t)
      .reduce((s, o) => s + Number(o.unit_price) * o.quantity, 0);

  const tableOrders = useMemo(
    () => (table === null ? [] : openOrders.filter((o) => o.floor === floor && o.table_no === table)),
    [openOrders, floor, table],
  );
  const tableTotal = tableOrders.reduce((s, o) => s + Number(o.unit_price) * o.quantity, 0);

  const addItem = async (m: { id: string; name: string; price: number }) => {
    if (table === null) return;
    const existing = tableOrders.find((o) => o.item_name === m.name && o.status === "beklemede");
    if (existing) {
      const { error } = await supabase
        .from("order_items")
        .update({ quantity: existing.quantity + 1 })
        .eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("order_items").insert({
        floor,
        table_no: table,
        menu_item_id: m.id,
        item_name: m.name,
        unit_price: m.price,
        quantity: 1,
        created_by: auth.user?.id ?? null,
      });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["open-orders"] });
  };

  const changeQty = async (o: OrderRow, delta: number) => {
    if (o.quantity + delta <= 0) return removeItem(o);
    const { error } = await supabase
      .from("order_items")
      .update({ quantity: o.quantity + delta })
      .eq("id", o.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["open-orders"] });
  };

  const removeItem = async (o: OrderRow) => {
    const { error } = await supabase.from("order_items").delete().eq("id", o.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["open-orders"] });
  };

  const clearTable = async () => {
    if (table === null) return;
    const { error } = await supabase
      .from("order_items")
      .delete()
      .eq("floor", floor)
      .eq("table_no", table)
      .is("check_id", null);
    if (error) return toast.error(error.message);
    toast.success("Masa sıfırlandı.");
    qc.invalidateQueries({ queryKey: ["open-orders"] });
  };

  const closeCheck = async (payment: string, note: string) => {
    if (table === null || tableOrders.length === 0) return;
    const { data: auth } = await supabase.auth.getUser();
    const { data: check, error } = await supabase
      .from("checks")
      .insert({
        floor,
        table_no: table,
        total: tableTotal,
        payment_method: payment,
        note: note || null,
        closed_by: auth.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !check) return toast.error(error?.message ?? "Hesap kapatılamadı.");

    const { error: linkError } = await supabase
      .from("order_items")
      .update({ check_id: check.id, status: "kapandi" })
      .eq("floor", floor)
      .eq("table_no", table)
      .is("check_id", null);
    if (linkError) return toast.error(linkError.message);

    toast.success(`Hesap kapatıldı: ${money(tableTotal)} — muhasebeye aktarıldı.`);
    qc.invalidateQueries({ queryKey: ["open-orders"] });
    setTable(null);
  };

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <div className="min-w-0 flex-1 p-4 sm:p-6">
        <h1 className="font-display text-2xl sm:text-3xl">KAT {floor} — MASALAR</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Sipariş eklemek veya hesabı kapatmak için bir masaya dokunun.
        </p>

        {/* Kat seçimi — mobilde üstte yatay */}
        <div className="mb-5 flex gap-2 lg:hidden">
          {FLOORS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFloor(f);
                setTable(null);
              }}
              className={`flex-1 rounded-md px-3 py-3 text-sm font-semibold transition-colors ${
                floor === f
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-accent"
              }`}
            >
              Kat {f}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {TABLES.map((t) => {
            const total = totalOf(floor, t);
            const busy = total > 0;
            return (
              <button
                key={t}
                onClick={() => setTable(t)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  busy ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                }`}
              >
                <p className="font-display text-2xl leading-none">{t}</p>
                <p className="mt-2 text-xs text-muted-foreground">{busy ? money(total) : "Boş"}</p>
              </button>
            );
          })}
        </div>
      </div>

      {table !== null && (
        <TablePanel
          floor={floor}
          table={table}
          orders={tableOrders}
          total={tableTotal}
          menu={menu}
          onClose={() => setTable(null)}
          onAdd={addItem}
          onQty={changeQty}
          onRemove={removeItem}
          onClear={clearTable}
          onCloseCheck={closeCheck}
        />
      )}

      {/* Kat seçimi — masaüstünde sağda */}
      <div className="hidden w-28 shrink-0 flex-col gap-2 border-l border-border p-3 lg:flex">
        {FLOORS.map((f) => (
          <button
            key={f}
            onClick={() => {
              setFloor(f);
              setTable(null);
            }}
            className={`rounded-md px-3 py-4 text-sm font-semibold transition-colors ${
              floor === f
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-accent"
            }`}
          >
            Kat {f}
          </button>
        ))}
      </div>
    </div>
  );
}

function TablePanel({
  floor,
  table,
  orders,
  total,
  menu,
  onClose,
  onAdd,
  onQty,
  onRemove,
  onClear,
  onCloseCheck,
}: {
  floor: number;
  table: number;
  orders: OrderRow[];
  total: number;
  menu: { id: string; name: string; category: string; price: number }[];
  onClose: () => void;
  onAdd: (m: { id: string; name: string; price: number }) => void;
  onQty: (o: OrderRow, d: number) => void;
  onRemove: (o: OrderRow) => void;
  onClear: () => void;
  onCloseCheck: (payment: string, note: string) => void;
}) {
  const [payment, setPayment] = useState<string>("nakit");
  const [note, setNote] = useState("");
  const categories = Array.from(new Set(menu.map((m) => m.category)));

  return (
    <aside className="fixed inset-0 z-40 flex flex-col border-border bg-card lg:static lg:z-auto lg:w-[26rem] lg:shrink-0 lg:border-l">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="font-semibold">
          Kat {floor} · Masa {table}
        </p>
        <button onClick={onClose} className="rounded p-2 hover:bg-accent" aria-label="Kapat">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[35vh] overflow-y-auto border-b border-border p-4 lg:max-h-[40vh]">
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu masada henüz sipariş yok.</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.item_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {o.status === "hazir" ? "hazır" : o.status}
                  </span>
                </span>
                <button onClick={() => onQty(o, -1)} className="rounded border border-border p-1.5">
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center">{o.quantity}</span>
                <button onClick={() => onQty(o, 1)} className="rounded border border-border p-1.5">
                  <Plus className="h-3 w-3" />
                </button>
                <span className="w-20 shrink-0 text-right">
                  {money(Number(o.unit_price) * o.quantity)}
                </span>
                <button onClick={() => onRemove(o)} className="rounded p-1.5 hover:bg-accent">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="mb-2 text-xs tracking-widest text-muted-foreground">MENÜ</p>
        {categories.map((c) => (
          <div key={c} className="mb-4">
            <p className="mb-1.5 text-sm font-semibold text-primary">{c}</p>
            <div className="grid grid-cols-2 gap-2">
              {menu
                .filter((m) => m.category === c)
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onAdd(m)}
                    className="rounded-md border border-border px-2 py-2.5 text-left text-xs hover:bg-accent"
                  >
                    <span className="block">{m.name}</span>
                    <span className="text-muted-foreground">{money(Number(m.price))}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Toplam</span>
          <span className="font-display text-2xl text-primary">{money(total)}</span>
        </div>
        <div className="flex gap-2">
          {PAYMENTS.map((p) => (
            <button
              key={p}
              onClick={() => setPayment(p)}
              className={`flex-1 rounded-md px-2 py-2.5 text-xs capitalize ${
                payment === p
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-accent"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Not (opsiyonel)"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => onCloseCheck(payment, note)}
          disabled={orders.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Receipt className="h-4 w-4" /> Hesabı kapat ve muhasebeye aktar
        </button>
        <button
          onClick={onClear}
          disabled={orders.length === 0}
          className="w-full rounded-md border border-border px-3 py-2.5 text-xs text-destructive disabled:opacity-50"
        >
          Masayı sıfırla (ödeme almadan)
        </button>
      </div>
    </aside>
  );
}
