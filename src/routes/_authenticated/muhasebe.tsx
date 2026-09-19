import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CloudUpload, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { runClosing } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/muhasebe")({
  head: () => ({
    meta: [
      { title: "Muhasebe | Adisyon" },
      { name: "description", content: "Kapanan hesaplar, saatlik ciro takibi ve gün sonu raporu." },
      { property: "og:title", content: "Muhasebe | Adisyon" },
      { property: "og:description", content: "Günlük ciro, notlar ve buluta gün sonu aktarımı." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountingPage,
});

const money = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

const todayIstanbul = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

const time = (iso: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

function AccountingPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIstanbul());
  const [busy, setBusy] = useState(false);
  const closing = useServerFn(runClosing);

  const { data: checks = [] } = useQuery({
    queryKey: ["checks", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checks")
        .select("id, floor, table_no, total, payment_method, note, closed_at")
        .gte("closed_at", `${date}T00:00:00.000Z`)
        .lte("closed_at", `${date}T23:59:59.999Z`)
        .order("closed_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: closings = [] } = useQuery({
    queryKey: ["closings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_closings")
        .select("id, closing_date, total, check_count, file_name, content, sync_status, sync_error, synced_at")
        .order("closing_date", { ascending: false })
        .limit(14);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const total = checks.reduce((s, c) => s + Number(c.total), 0);
  const byHour = new Map<string, number>();
  for (const c of checks) {
    const h = time(c.closed_at).slice(0, 2) + ":00";
    byHour.set(h, (byHour.get(h) ?? 0) + Number(c.total));
  }

  const saveNote = async (id: string, note: string) => {
    const { error } = await supabase.from("checks").update({ note }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Not kaydedildi.");
    qc.invalidateQueries({ queryKey: ["checks", date] });
  };

  const doClosing = async () => {
    setBusy(true);
    try {
      const res = await closing({ data: { date } });
      if (res.syncStatus === "senkronize") toast.success("Gün sonu buluta yüklendi.");
      else if (res.syncStatus === "bulut_baglanmadi")
        toast.warning("Gün sonu kaydedildi, bulut hesabı henüz bağlı değil.");
      else toast.error(`Gün sonu kaydedildi ama yükleme başarısız: ${res.syncError ?? ""}`);
      qc.invalidateQueries({ queryKey: ["closings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gün sonu alınamadı.");
    } finally {
      setBusy(false);
    }
  };

  const download = (fileName: string, content: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <h1 className="font-display text-3xl">MUHASEBE</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Kapatılan her hesap buraya saati ve tutarıyla düşer.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Tarih</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="panel px-4 py-2.5">
          <p className="text-xs text-muted-foreground">Günlük ciro</p>
          <p className="font-display text-2xl text-primary">{money(total)}</p>
        </div>
        <div className="panel px-4 py-2.5">
          <p className="text-xs text-muted-foreground">Adisyon</p>
          <p className="font-display text-2xl">{checks.length}</p>
        </div>
        <button
          onClick={doClosing}
          disabled={busy}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <CloudUpload className="h-4 w-4" /> {busy ? "Gönderiliyor..." : "Gün sonunu buluta gönder"}
        </button>
      </div>

      {byHour.size > 0 && (
        <div className="mb-8">
          <p className="mb-2 text-xs tracking-widest text-muted-foreground">SAATLİK CİRO</p>
          <div className="flex flex-wrap gap-2">
            {[...byHour.entries()]
              .sort()
              .map(([h, v]) => (
                <div key={h} className="rounded-md border border-border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{h}</span>{" "}
                  <span className="font-semibold">{money(v)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <section className="mb-10">
        <p className="mb-3 text-xs tracking-widest text-muted-foreground">KAPANAN HESAPLAR</p>
        {checks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu tarihte kapanan hesap yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left">Saat</th>
                  <th className="px-2 py-2 text-left">Kat</th>
                  <th className="px-2 py-2 text-left">Masa</th>
                  <th className="px-2 py-2 text-right">Tutar</th>
                  <th className="px-2 py-2 text-left">Ödeme</th>
                  <th className="px-2 py-2 text-left">Not</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <NoteRow key={c.id} check={c} onSave={saveNote} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <p className="mb-3 text-xs tracking-widest text-muted-foreground">GÜN SONU DOSYALARI</p>
        {closings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz gün sonu alınmadı.</p>
        ) : (
          <ul className="space-y-2">
            {closings.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm"
              >
                <span className="font-semibold">{c.closing_date}</span>
                <span className="text-muted-foreground">
                  {c.check_count} adisyon · {money(Number(c.total))}
                </span>
                <span className="rounded bg-secondary px-2 py-1 text-[10px] uppercase">
                  {c.sync_status}
                </span>
                {c.sync_error && (
                  <span className="text-xs text-destructive">{c.sync_error}</span>
                )}
                <button
                  onClick={() => download(c.file_name ?? "gun-sonu.txt", c.content ?? "")}
                  className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <Download className="h-3.5 w-3.5" /> Metni indir
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NoteRow({
  check,
  onSave,
}: {
  check: {
    id: string;
    floor: number;
    table_no: number;
    total: number;
    payment_method: string;
    note: string | null;
    closed_at: string;
  };
  onSave: (id: string, note: string) => void;
}) {
  const [note, setNote] = useState(check.note ?? "");
  return (
    <tr className="border-b border-border/60">
      <td className="px-2 py-2">{time(check.closed_at)}</td>
      <td className="px-2 py-2">{check.floor}</td>
      <td className="px-2 py-2">{check.table_no}</td>
      <td className="px-2 py-2 text-right font-semibold">{money(Number(check.total))}</td>
      <td className="px-2 py-2 capitalize">{check.payment_method}</td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Not ekle"
            className="min-w-32 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
          />
          <button
            onClick={() => onSave(check.id, note)}
            className="rounded-md border border-border p-1.5 hover:bg-accent"
          >
            <Save className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
