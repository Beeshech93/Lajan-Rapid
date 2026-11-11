import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

const ASSET_LINKS = [
  {
    relation: [
      "delegate_permission/common.handle_all_urls",
      "delegate_permission/common.get_login_creds",
    ],
    target: {
      namespace: "android_app",
      package_name: "lajanrapid.aab",
      sha256_cert_fingerprints: [
        "8B:85:E2:D6:D6:7B:FB:E3:2D:94:D4:DE:1B:FA:E6:A1:90:91:18:64:CF:BC:99:3D:8D:A3:8E:7E:9F:8A:76:23",
        "73:21:73:B9:88:47:9C:E0:F4:99:AC:D8:D1:E9:E9:99:C6:27:EB:67:8F:29:F3:23:8A:D6:AC:9B:63:9A:87:A1",
        "70:00:D3:95:74:A0:4D:7A:F3:AB:F7:04:8E:0B:CE:33:DD:69:7E:56:38:40:81:FE:3C:0D:DC:9E:1F:B1:68:93",
        "CC:61:21:A2:45:53:AA:A3:BF:4D:94:B3:79:3C:E6:14:6E:7C:78:2D:B5:D9:78:9D:1B:84:F7:DF:50:6D:18:02",
      ],
    },
  },
];

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/.well-known/assetlinks.json") {
        return new Response(JSON.stringify(ASSET_LINKS, null, 2), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "access-control-allow-origin": "*",
            "cache-control": "public, max-age=86400",
          },
        });
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
