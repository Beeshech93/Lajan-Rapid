import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { EXTERNAL_FRONTEND_ORIGINS } from "./lib/remote-api";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const isTrustedExternal = (origin: string | null | undefined) =>
  !!origin && EXTERNAL_FRONTEND_ORIGINS.includes(origin);

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  origin: (value, ctx) =>
    value === new URL(ctx.request.url).origin || isTrustedExternal(value),
  secFetchSite: (value, ctx) =>
    value === "same-origin" || isTrustedExternal(ctx.request.headers.get("origin")),
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
