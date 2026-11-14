import { useState, useEffect } from "react";
import { X, Download, Share, PlusSquare, Smartphone } from "lucide-react";
import logoAsset from "@/assets/lajan-rapid-logo.png";
import { useI18n } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "pwa_install_prompt_dismissed_until";
const DISMISS_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 días

export function InstallAppPrompt() {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Si ya está instalada como PWA (modo standalone), no mostrar
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone) ||
      document.referrer.includes("android-app://");

    if (isStandalone) return;

    // Verificar si el usuario lo descartó recientemente
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      return;
    }

    const ua = navigator.userAgent || "";
    const iosDevice = /iPhone|iPad|iPod/.test(ua);
    setIsIos(iosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // En dispositivos móviles (iOS o Android) donde beforeinstallprompt no se dispare de inmediato,
    // mostrar el banner después de una breve pausa (1.5s)
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const timer = setTimeout(() => {
      if (isMobile) {
        setIsVisible(true);
      }
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS));
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsVisible(false);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error("Error al invocar instalación:", err);
      }
      return;
    }

    // Si no hay prompt nativo disponible (ej. iOS Safari o navegador sin beforeinstallprompt),
    // alternar las instrucciones paso a paso
    setShowInstructions((prev) => !prev);
  };

  if (!isVisible) return null;

  return (
    <aside
      role="region"
      aria-label="Instalación de aplicación"
      className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="relative overflow-hidden rounded-[1.75rem] bg-surface-elevated/95 backdrop-blur-2xl p-5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] border border-white/10 text-white ring-1 ring-white/10 before:absolute before:inset-x-8 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-primary/80 before:to-transparent">
        {/* Cabecera: Icono + Título/Descripción + Botón Cerrar */}
        <div className="flex items-start gap-3.5">
          {/* Icono de la App (superficie blanca limpia con el logo nítido) */}
          <div className="size-13 shrink-0 rounded-2xl bg-white p-2 shadow-soft ring-1 ring-white/20 flex items-center justify-center">
            <img
              src={logoAsset}
              alt="Lajan Rapid"
              className="h-full w-full object-contain"
            />
          </div>

          {/* Textos de alto contraste y legibilidad */}
          <div className="flex-1 min-w-0 pr-1">
            <h3 className="font-display font-bold text-base sm:text-lg text-white tracking-tight leading-snug">
              {t("install.prompt_title")}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-snug">
              {t("install.prompt_desc")}
            </p>
          </div>

          {/* Botón X Cerrar */}
          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 -mr-1 -mt-1 rounded-full transition-colors active:scale-95 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="size-4 sm:size-5" />
          </button>
        </div>

        {/* Instrucciones desplegables si se requiere en iOS / navegadores sin prompt automático */}
        {showInstructions && (
          <div className="mt-3.5 rounded-2xl bg-surface-secondary/90 border border-white/10 p-3.5 text-xs sm:text-sm text-slate-200 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {isIos ? (
              <div className="space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5 text-primary">
                  <Smartphone className="size-4" /> Para iPhone / iPad (Safari):
                </p>
                <p className="flex items-center gap-2">
                  <Share className="size-4 shrink-0 text-primary" />
                  <span>1. {t("install.ios_step1")}</span>
                </p>
                <p className="flex items-center gap-2">
                  <PlusSquare className="size-4 shrink-0 text-primary" />
                  <span>2. {t("install.ios_step2")}</span>
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5 text-primary">
                  <Smartphone className="size-4" /> Para Android (Chrome):
                </p>
                <p className="text-slate-300 leading-relaxed">
                  {t("install.android_instructions")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Botón principal: Verde vibrante característico de Lajan Rapid */}
        <button
          type="button"
          onClick={handleInstallClick}
          className="mt-4 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-display font-bold py-3.5 px-4 text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.99] transition-all cursor-pointer"
        >
          <Download className="size-4.5 stroke-[2.5]" />
          <span>{t("install.prompt_btn")}</span>
        </button>
      </div>
    </aside>
  );
}

