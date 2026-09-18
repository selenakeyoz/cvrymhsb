import { createFileRoute } from "@tanstack/react-router";

/** Gün sonu otomatik senkronizasyonu (zamanlanmış görev tarafından çağrılır). */
export const Route = createFileRoute("/api/public/hooks/gun-sonu")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("x-cron-key");
        const expected = process.env["CRON_SECRET"];
        if (!expected || key !== expected) {
          return new Response(JSON.stringify({ error: "Yetkisiz" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const { runDailyClosing } = await import("@/lib/closing.server");
        const istanbulDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Istanbul",
        }).format(new Date(Date.now() - 4 * 60 * 60 * 1000));

        const result = await runDailyClosing(istanbulDate);
        return new Response(
          JSON.stringify({
            ok: true,
            date: result.date,
            total: result.total,
            syncStatus: result.syncStatus,
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
