import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/lajan-rapid-logo.png.asset.json";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export type ContentSection = { title: string; body: string; list?: string[] };

export function ContentPage({
  heading,
  intro,
  sections,
  cta,
}: {
  heading: string;
  intro: string;
  sections: ContentSection[];
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
        <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{heading}</h1>
        <p className="mt-4 max-w-xl text-muted-foreground">{intro}</p>
        <Button asChild size="lg" className="mt-6 gap-2">
          <Link to="/auth" search={{ modo: "registro" }}>
            {cta} <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <section className="mx-auto max-w-3xl space-y-8 px-5 pb-16">
        {sections.map((s) => (
          <div key={s.title}>
            <h2 className="font-display text-xl font-semibold">{s.title}</h2>
            <p className="mt-2 text-muted-foreground">{s.body}</p>
            {s.list && (
              <ul className="mt-3 space-y-1.5">
                {s.list.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
