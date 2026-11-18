import { useState, useEffect } from "react";
import { X, Download, Share, PlusSquare, Smartphone } from "lucide-react";
import logoAsset from "@/assets/lajan-rapid-logo.png";
import { useI18n } from "@/lib/i18n";
import { useBrand } from "@/lib/brand-context";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "pwa_install_prompt_dismissed_v2";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 1 día

export function InstallAppPrompt() {
  const { t } = useI18n();
  const { currentBrand, isCustomBrand } = useBrand();
  const [isVisible, setIsVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const appLogo = currentBrand.branding.appIconUrl || currentBrand.branding.logoUrl || logoAsset;
  const appName = isCustomBrand ? currentBrand.name : "Lajan Rapid";

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
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth < 768;

    // En formato web normal (escritorio), no mostrar el banner flotante de instalación
    if (!isMobile) return;

    const iosDevice = /iPhone|iPad|iPod/.test(ua);
    setIsIos(iosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // En dispositivos móviles (iOS o Android) donde beforeinstallprompt no se dispare de inmediato,
    // mostrar el banner después de una breve pausa (1.2s)
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1200);

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
    <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center p-4 pb-6 pointer-events-none">
      {/* Fondo semitransparente con desenfoque suave */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-300 animate-in fade-in"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Tarjeta flotante estilo modal inferior idéntico al diseño */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Instalación de aplicación"
        className="relative w-full max-w-md pointer-events-auto animate-in fade-in slide-in-from-bottom-6 duration-300"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="relative overflow-hidden rounded-[28px] bg-white p-5 sm:p-6 shadow-2xl text-slate-900 border border-slate-100">
          {/* Cabecera: Icono Squircle Negro + Título/Descripción + Botón X */}
          <div className="flex items-start gap-3.5">
            {/* Logo en squircle elegante adaptado a la marca */}
            <div
              className="size-13 sm:size-14 shrink-0 rounded-2xl p-2 flex items-center justify-center shadow-sm overflow-hidden"
              style={{
                backgroundColor: currentBrand.branding.surfaceColor || "#000000",
                border: `1px solid ${currentBrand.branding.primaryColor}30`,
              }}
            >
              <img
                src={appLogo}
                alt={appName}
                className="h-full w-full object-contain"
              />
            </div>

            {/* Título y descripción con tipografía limpia y de alto contraste */}
            <div className="flex-1 min-w-0 pr-1 pt-0.5">
              <h3 className="font-semibold text-base sm:text-lg text-slate-900 leading-snug tracking-tight">
                {isCustomBrand ? `Instalar ${appName}` : t("install.prompt_title")}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-snug font-normal">
                {isCustomBrand
                  ? `Agrega ${appName} a tu pantalla de inicio para acceso rápido.`
                  : t("install.prompt_desc")}
              </p>
            </div>

            {/* Botón X Cerrar */}
            <button
              type="button"
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-700 p-1 -mr-1 -mt-1 rounded-full transition-colors active:scale-95 cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="size-5 stroke-[2]" />
            </button>
          </div>

          {/* Instrucciones desplegables si se requiere en iOS / navegadores sin prompt automático */}
          {showInstructions && (
            <div className="mt-3.5 rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs sm:text-sm text-slate-700 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {isIos ? (
                <div className="space-y-1.5">
                  <p className="font-semibold flex items-center gap-1.5 text-slate-900">
                    <Smartphone className="size-4 text-primary" /> Para iPhone / iPad (Safari):
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
                  <p className="font-semibold flex items-center gap-1.5 text-slate-900">
                    <Smartphone className="size-4 text-primary" /> Para Android (Chrome):
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    {t("install.android_instructions")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Botón principal negro: Instalar App */}
          <button
            type="button"
            onClick={handleInstallClick}
            className="mt-4 w-full rounded-2xl bg-[#121212] hover:bg-black text-white font-medium py-3.5 px-4 text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-all cursor-pointer"
          >
            <Download className="size-4.5 stroke-[2.2]" />
            <span>{t("install.prompt_btn")}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

