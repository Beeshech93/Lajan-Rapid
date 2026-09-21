import { useState } from "react";
import { Download, Share, Menu as MenuIcon, PlusSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

function detectPlatform(): "android" | "ios" {
  if (typeof navigator === "undefined") return "android";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  return "android";
}

export function InstallAppCard() {
  const { t } = useI18n();
  const [platform, setPlatform] = useState<"android" | "ios">(detectPlatform);

  return (
    <Card className="border-transparent shadow-soft">
      <CardContent className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent">
            <Download className="size-4" />
          </span>
          <h2 className="font-display text-lg font-semibold">{t("install.title")}</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("install.subtitle")}</p>

        <div className="mt-4 inline-flex rounded-full bg-secondary p-1 text-sm">
          <button
            type="button"
            onClick={() => setPlatform("android")}
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
              platform === "android" ? "bg-card shadow-soft" : "text-muted-foreground"
            }`}
          >
            Android
          </button>
          <button
            type="button"
            onClick={() => setPlatform("ios")}
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
              platform === "ios" ? "bg-card shadow-soft" : "text-muted-foreground"
            }`}
          >
            iPhone
          </button>
        </div>

        {platform === "android" ? (
          <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MenuIcon className="mt-0.5 size-4 shrink-0" />
              {t("install.android_step1")}
            </li>
            <li className="flex items-start gap-2">
              <PlusSquare className="mt-0.5 size-4 shrink-0" />
              {t("install.android_step2")}
            </li>
          </ol>
        ) : (
          <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Share className="mt-0.5 size-4 shrink-0" />
              {t("install.ios_step1")}
            </li>
            <li className="flex items-start gap-2">
              <PlusSquare className="mt-0.5 size-4 shrink-0" />
              {t("install.ios_step2")}
            </li>
          </ol>
        )}

        <p className="mt-4 text-xs text-muted-foreground">{t("install.note")}</p>
      </CardContent>
    </Card>
  );
}

export function InstallButton({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={className}
      onClick={() => {
        document.getElementById("install-app")?.scrollIntoView({ behavior: "smooth" });
      }}
    >
      <Download className="size-4" /> {t("install.cta")}
    </Button>
  );
}
