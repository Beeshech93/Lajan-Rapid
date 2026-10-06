import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Config propia (sin el envoltorio @lovable.dev/vite-tanstack-config), para
// que el proyecto compile y despliegue de forma independiente.
// El preset de salida se detecta solo: Vercel define process.env.VERCEL en
// sus builds; en cualquier otro entorno (incluido Lovable) se genera el
// formato Cloudflare Workers, que es el que la plataforma de Lovable sabe
// desplegar. Así este archivo no hay que tocarlo según dónde se publique.
const ON_VERCEL = Boolean(process.env["VERCEL"]);
const NITRO_PRESET = ON_VERCEL ? "vercel" : "cloudflare-module";

export default defineConfig({
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "server" },
    }),
    nitro({
      preset: NITRO_PRESET,
      ...(ON_VERCEL ? {} : { cloudflare: { nodeCompat: true, deployConfig: true } }),
    }),
    viteReact(),
  ],
});
