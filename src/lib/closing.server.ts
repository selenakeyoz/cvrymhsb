const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive";

export type ClosingResult = {
  date: string;
  total: number;
  checkCount: number;
  fileName: string;
  content: string;
  syncStatus: string;
  syncError: string | null;
};

const money = (n: number) => n.toFixed(2).replace(".", ",") + " TL";

/** Verilen gün için kapanan adisyonlardan metin dosyası üretir, kaydeder ve buluta yüklemeyi dener. */
export async function runDailyClosing(dateISO: string): Promise<ClosingResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const start = `${dateISO}T00:00:00.000Z`;
  const end = `${dateISO}T23:59:59.999Z`;

  const { data: checks, error } = await supabaseAdmin
    .from("checks")
    .select("id, floor, table_no, total, payment_method, note, closed_at")
    .gte("closed_at", start)
    .lte("closed_at", end)
    .order("closed_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = checks ?? [];
  const total = rows.reduce((sum, c) => sum + Number(c.total), 0);
  const fmt = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines: string[] = [];
  lines.push("GÜN SONU ADİSYON RAPORU");
  lines.push(`Tarih: ${dateISO}`);
  lines.push("".padEnd(52, "-"));
  lines.push("Saat  Kat  Masa  Tutar           Ödeme    Not");
  for (const c of rows) {
    lines.push(
      [
        fmt.format(new Date(c.closed_at)).padEnd(6),
        String(c.floor).padEnd(5),
        String(c.table_no).padEnd(6),
        money(Number(c.total)).padEnd(16),
        (c.payment_method ?? "").padEnd(9),
        c.note ?? "",
      ].join(""),
    );
  }
  lines.push("".padEnd(52, "-"));
  lines.push(`Adisyon sayısı: ${rows.length}`);
  lines.push(`Günlük ciro: ${money(total)}`);
  const content = lines.join("\n");
  const fileName = `gun-sonu-${dateISO}.txt`;

  let syncStatus = "beklemede";
  let syncError: string | null = null;
  let syncedAt: string | null = null;

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const driveKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !driveKey) {
    syncStatus = "bulut_baglanmadi";
    syncError = "Google Drive hesabı henüz bağlanmadı.";
  } else {
    try {
      const boundary = "----lovable" + crypto.randomUUID();
      const metadata = JSON.stringify({
        name: fileName,
        mimeType: "text/plain",
        ...(process.env["DRIVE_FOLDER_ID"]
          ? { parents: [process.env["DRIVE_FOLDER_ID"]!] }
          : {}),
      });
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${content}\r\n` +
        `--${boundary}--`;

      const res = await fetch(
        `${GATEWAY_URL}/upload/drive/v3/files?uploadType=multipart&fields=id,name`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": driveKey,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      );
      if (!res.ok) {
        const text = await res.text();
        console.error(`Drive upload failed [${res.status}]: ${text}`);
        syncStatus = "hata";
        syncError = `Yükleme başarısız (${res.status})`;
      } else {
        syncStatus = "senkronize";
        syncedAt = new Date().toISOString();
      }
    } catch (e) {
      syncStatus = "hata";
      syncError = e instanceof Error ? e.message : "Bilinmeyen hata";
    }
  }

  const { error: upsertError } = await supabaseAdmin.from("daily_closings").upsert(
    {
      closing_date: dateISO,
      total,
      check_count: rows.length,
      file_name: fileName,
      content,
      sync_status: syncStatus,
      sync_error: syncError,
      synced_at: syncedAt,
    },
    { onConflict: "closing_date" },
  );
  if (upsertError) throw new Error(upsertError.message);

  return { date: dateISO, total, checkCount: rows.length, fileName, content, syncStatus, syncError };
}
