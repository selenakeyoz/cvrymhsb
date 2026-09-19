import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/menu")({
  head: () => ({
    meta: [
      { title: "Menü Yönetimi | Adisyon" },
      { name: "description", content: "Ürünleri ekleyin, fiyatlandırın, aktif veya pasif yapın." },
      { property: "og:title", content: "Menü Yönetimi | Adisyon" },
      { property: "og:description", content: "Mutfak menüyü buradan yönetir." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MenuPage,
});

const money = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

function MenuPage() {
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

  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("menu_items").update({ is_active: !active }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["menu-all"] });
    qc.invalidateQueries({ queryKey: ["menu-active"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Ürün silindi.");
    qc.invalidateQueries({ queryKey: ["menu-all"] });
    qc.invalidateQueries({ queryKey: ["menu-active"] });
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
    qc.invalidateQueries({ queryKey: ["menu-all"] });
    qc.invalidateQueries({ queryKey: ["menu-active"] });
  };

  return (
    <div className="p-6">
      <h1 className="font-display text-3xl">MENÜ</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Pasif yapılan ürünler katlardaki sipariş ekranında görünmez.
      </p>

      <form onSubmit={add} className="panel mb-8 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-40 flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">Ürün adı</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="min-w-32">
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
        <div className="w-28">
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
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
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
                  className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm"
                >
                  <span className={`flex-1 ${i.is_active ? "" : "text-muted-foreground line-through"}`}>
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
    </div>
  );
}
