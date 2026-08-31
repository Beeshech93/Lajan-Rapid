import { createFileRoute } from "@tanstack/react-router";

/** Diagnóstico temporal de la conexión Bazik. */
export const Route = createFileRoute("/api/public/bazik/diag")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("k") !== "diag-9f2a") {
          return new Response("no", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("integration_credentials")
          .select("name, value")
          .in("name", ["BAZIK_USER_ID", "BAZIK_SECRET_KEY"]);
        const creds: Record<string, string> = {};
        for (const r of data ?? []) creds[r.name] = r.value as string;
        const out: Record<string, unknown> = {};
        const tokenRes = await fetch("https://api.bazik.io/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userID: creds["BAZIK_USER_ID"],
            secretKey: creds["BAZIK_SECRET_KEY"],
          }),
        });
        const tokenText = await tokenRes.text();
        out["tokenStatus"] = tokenRes.status;
        let token = "";
        try {
          const j = JSON.parse(tokenText) as Record<string, unknown>;
          out["tokenKeys"] = Object.keys(j);
          token = String(j["token"] ?? j["access_token"] ?? j["accessToken"] ?? "");
          if (!token) out["tokenBody"] = tokenText.slice(0, 300);
        } catch {
          out["tokenBody"] = tokenText.slice(0, 300);
        }
        if (!token) return Response.json(out);
        const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        for (const p of ["/balance", "/wallet"]) {
          const r = await fetch(`https://api.bazik.io${p}`, { headers: auth });
          out[p] = { status: r.status, body: (await r.text()).slice(0, 400) };
        }
        for (const p of ["/moncash/withdraw", "/natcash/transfers", "/transfers/quote"]) {
          const r = await fetch(`https://api.bazik.io${p}`, {
            method: "POST",
            headers: auth,
            body: JSON.stringify({}),
          });
          out[p] = { status: r.status, body: (await r.text()).slice(0, 400) };
        }
        return Response.json(out);
      },
    },
  },
});
