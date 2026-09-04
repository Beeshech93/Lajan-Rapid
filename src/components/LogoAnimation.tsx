import { useEffect, useState } from "react";
import logoAsset from "@/assets/lajan-rapid-logo.png.asset.json";

const CELEBRATE_EVENT = "lajan:celebrate";

/** Dispara la animación del logo al finalizar una transacción. */
export function celebrateLogo() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT));
  }
}

/** Animación de entrada del logo al abrir la app (una vez por sesión). */
export function LogoIntro() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem("lajan_intro_done")) return;
      sessionStorage.setItem("lajan_intro_done", "1");
    } catch {
      /* sesión no disponible: mostramos igual */
    }
    setVisible(true);
    const out = window.setTimeout(() => setLeaving(true), 1200);
    const done = window.setTimeout(() => setVisible(false), 1750);
    return () => {
      window.clearTimeout(out);
      window.clearTimeout(done);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[200] grid place-items-center bg-brand ${
        leaving ? "logo-veil-out" : ""
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <span className="logo-pop grid size-28 place-items-center overflow-hidden rounded-3xl bg-primary-foreground p-3 shadow-lift">
          <img src={logoAsset.url} alt="" className="h-full w-full object-contain" />
        </span>
        <span className="logo-shine h-1 w-24 rounded-full bg-primary/70" />
      </div>
    </div>
  );
}

/** Animación del logo cuando se completa una transacción. */
export function LogoCelebration() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onCelebrate = () => {
      setActive(true);
      window.setTimeout(() => setActive(false), 1600);
    };
    window.addEventListener(CELEBRATE_EVENT, onCelebrate);
    return () => window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
  }, []);

  if (!active) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[190] grid place-items-center">
      <div className="relative grid place-items-center">
        <span className="logo-ring absolute size-32 rounded-full border-2 border-primary" />
        <span className="logo-ring logo-ring-delay absolute size-32 rounded-full border-2 border-primary" />
        <span className="logo-celebrate grid size-24 place-items-center overflow-hidden rounded-3xl bg-primary-foreground p-3 shadow-lift">
          <img src={logoAsset.url} alt="" className="h-full w-full object-contain" />
        </span>
      </div>
    </div>
  );
}
