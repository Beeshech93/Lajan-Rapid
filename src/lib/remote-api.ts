// When the app's screens are served from an external host (e.g. Vercel at
// lajanrapid.app), route server-function calls to the Lovable-hosted backend,
// which holds the private server secrets.
export const LOVABLE_BACKEND_ORIGIN = "https://lajanrapid-app.lovable.app";
export const EXTERNAL_FRONTEND_ORIGINS = ["https://lajanrapid.app", "https://www.lajanrapid.app"];

if (typeof window !== "undefined" && EXTERNAL_FRONTEND_ORIGINS.includes(window.location.origin)) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    if (url.origin === window.location.origin && url.pathname.startsWith("/_serverFn")) {
      const target = LOVABLE_BACKEND_ORIGIN + url.pathname + url.search;
      if (input instanceof Request) return originalFetch(new Request(target, input), init);
      return originalFetch(target, init);
    }
    return originalFetch(input, init);
  };
}
