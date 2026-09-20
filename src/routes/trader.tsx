import { createFileRoute, Link } from "@tanstack/react-router";
import logoAsset from "@/assets/lajan-rapid-logo.png.asset.json";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bitcoin } from "lucide-react";

export const Route = createFileRoute("/trader")({
  head: () => ({
    meta: [
      { title: "Cash Out Crypto to MonCash & NatCash | Lajan Rapid" },
      {
        name: "description",
        content:
          "Traders and crypto holders can withdraw BTC, USDT and USDC directly to MonCash or NatCash in Haiti with Lajan Rapid.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Cash Out Crypto to MonCash & NatCash | Lajan Rapid" },
      {
        property: "og:description",
        content:
          "Traders and crypto holders can withdraw BTC, USDT and USDC directly to MonCash or NatCash in Haiti with Lajan Rapid.",
      },
    ],
    links: [
      { rel: "canonical", href: "https://lajanrapid.app/trader" },
      { rel: "alternate", hreflang: "en", href: "https://lajanrapid.app/trader" },
      { rel: "alternate", hreflang: "es", href: "https://lajanrapid.app/es/trader" },
      { rel: "alternate", hreflang: "fr", href: "https://lajanrapid.app/fr/trader" },
      { rel: "alternate", hreflang: "ht", href: "https://lajanrapid.app/ht/trader" },
      { rel: "alternate", hreflang: "x-default", href: "https://lajanrapid.app/trader" },
    ],
  }),
  component: () => (
    <TraderPage
      heading="Cash out your crypto to MonCash or NatCash"
      subheading="For traders and crypto holders in Haiti: withdraw BTC, USDT or USDC directly to your MonCash or NatCash mobile wallet — no third-party exchange needed."
      howTitle="How it works"
      steps={[
        "Sign up and verify your identity (KYC).",
        "Go to the Crypto section and choose the asset (BTC, USDT or USDC) and network.",
        "Request a withdrawal to MonCash or NatCash, entering the receiving mobile number.",
        "Confirm the exchange rate and fee, then confirm the withdrawal.",
        "Funds arrive in the recipient's MonCash or NatCash wallet.",
      ]}
      assetsTitle="Supported assets"
      cta="Open my account"
    />
  ),
});

export function TraderPage({
  heading,
  subheading,
  howTitle,
  steps,
  assetsTitle,
  cta,
}: {
  heading: string;
  subheading: string;
  howTitle: string;
  steps: string[];
  assetsTitle: string;
  cta: string;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-logo-surface p-1 shadow-soft">
            <img src={logoAsset.url} alt="Lajan Rapid" className="h-full w-full object-contain" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">Lajan Rapid</span>
        </Link>
        <LanguageSwitcher className="h-9 w-[132px] text-xs" />
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-6 pt-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Bitcoin className="size-3.5" /> BTC · USDT · USDC
        </span>
        <h1 className="mt-5 font-display text-3xl font-bold leading-tight sm:text-4xl">
          {heading}
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">{subheading}</p>
        <Button asChild size="lg" className="mt-6 gap-2">
          <Link to="/auth" search={{ modo: "registro" }}>
            {cta} <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <section className="mx-auto max-w-3xl space-y-3 px-5 py-6">
        <h2 className="font-display text-xl font-semibold">{howTitle}</h2>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-sm text-muted-foreground">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-16">
        <h2 className="font-display text-xl font-semibold">{assetsTitle}</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-xl border p-4">
            <p className="font-semibold">BTC</p>
            <p className="text-xs text-muted-foreground">Bitcoin</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-semibold">USDT</p>
            <p className="text-xs text-muted-foreground">ERC20 / BEP20 / TRC20</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-semibold">USDC</p>
            <p className="text-xs text-muted-foreground">ERC20</p>
          </div>
        </div>
      </section>
    </div>
  );
}
