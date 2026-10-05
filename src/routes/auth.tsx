import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logoAsset from "@/assets/lajan-rapid-logo.png";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { DIAL_COUNTRIES, expectedLengths, formatNational, validatePhone } from "@/lib/phone";

const searchSchema = z.object({ modo: z.enum(["ingreso", "registro"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Acceder — Lajan Rapid" },
      {
        name: "description",
        content:
          "Inicia sesión o crea tu cuenta en Lajan Rapid con tu teléfono de cualquier país y envía dinero a Haití y República Dominicana.",
      },
      { property: "og:title", content: "Acceder — Lajan Rapid" },
      {
        property: "og:description",
        content: "Entra a tu cuenta Lajan Rapid y envía dinero a Haití o República Dominicana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { modo } = Route.useSearch();
  const [tab, setTab] = useState(modo === "registro" ? "registro" : "ingreso");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [dial, setDial] = useState("HT");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const country = DIAL_COUNTRIES.find((c) => c.code === dial);
  const check = validatePhone(dial, country?.dial ?? "+509", phoneInput);
  const lens = expectedLengths(dial);
  const digitsHint = lens.length ? lens.join(" o ") : "5–14";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/dashboard", replace: true });
    });
  }, [router]);

  const handle = async (e: React.FormEvent<HTMLFormElement>, mode: "ingreso" | "registro") => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const credSchema = z.object({
      email: z.string().trim().email(t("auth.invalid_email")).max(255),
      password: z.string().min(8, t("auth.min_password")).max(72),
    });
    const parsed = credSchema.safeParse({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("auth.invalid"));
      return;
    }

    let phone = "";
    if (mode === "registro") {
      if (!check.ok || !check.e164) {
        setPhoneError(t("auth.invalid_phone"));
        toast.error(t("auth.invalid_phone"));
        return;
      }
      phone = check.e164;
    }

    setLoading(true);
    try {
      if (mode === "registro") {
        const fullName = String(form.get("full_name") ?? "")
          .trim()
          .slice(0, 100);
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, phone, country: dial, language: lang },
          },
        });
        if (error) throw error;
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          toast.success(t("auth.created"));
          router.navigate({ to: "/dashboard", replace: true });
        } else {
          toast.success(t("auth.check_email"));
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        router.navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const parsed = z.string().trim().email(t("auth.invalid_email")).max(255).safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("auth.invalid"));
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/restablecer-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand px-5 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-sm flex-col">
        <div className="mb-2 flex items-center justify-between">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-foreground hover:bg-white/10"
            aria-label={t("nav.home") || "Volver al inicio"}
          >
            <Link to="/">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <LanguageSwitcher className="h-9 w-[150px] border-white/20 bg-white/10 text-xs text-foreground" />
        </div>

        <div className="mb-8 mt-6 text-center">
          <Link
            to="/"
            className="inline-block rounded-2xl transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Ir al inicio"
          >
            <span className="mx-auto grid size-16 place-items-center overflow-hidden rounded-2xl bg-logo-surface p-2 shadow-lift">
              <img src={logoAsset} alt="Lajan Rapid" className="h-full w-full object-contain" />
            </span>
          </Link>
          <h1 className="mt-5 font-display text-3xl font-bold leading-tight">
            {tab === "registro" ? t("auth.welcome") : t("auth.welcome")}
          </h1>
          <p className="mx-auto mt-2 max-w-[280px] text-sm text-foreground/70">
            {t("auth.subtitle")}
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2 rounded-full bg-white/10 p-1">
            <TabsTrigger
              value="ingreso"
              className="press rounded-full text-foreground/70 data-[state=active]:bg-primary-foreground data-[state=active]:text-primary"
            >
              {t("auth.signin")}
            </TabsTrigger>
            <TabsTrigger
              value="registro"
              className="press rounded-full text-foreground/70 data-[state=active]:bg-primary-foreground data-[state=active]:text-primary"
            >
              {t("auth.signup")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ingreso" className="mt-6">
            <form className="space-y-4" onSubmit={(e) => handle(e, "ingreso")}>
              <Field id="email-in" name="email" label={t("auth.email")} type="email" />
              <Field id="pass-in" name="password" label={t("auth.password")} type="password" />
              <Button
                className="press h-12 w-full gap-2 rounded-full bg-primary-foreground text-primary shadow-lift hover:bg-primary-foreground/90"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {t("auth.entering")}
                  </>
                ) : (
                  <>
                    {t("auth.enter")} <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-foreground/70 underline underline-offset-2 hover:text-foreground"
                onClick={() => {
                  setShowForgot(true);
                  setResetSent(false);
                }}
              >
                {t("auth.forgot_password")}
              </button>
            </form>
          </TabsContent>

          <TabsContent value="registro" className="mt-6">
            <form className="space-y-4" onSubmit={(e) => handle(e, "registro")}>
              <Field id="name-up" name="full_name" label={t("auth.fullname")} />

              <div className="space-y-1.5">
                <Label htmlFor="phone-up">{t("auth.phone")}</Label>
                <div className="flex gap-2">
                  <Select
                    value={dial}
                    onValueChange={(v) => {
                      setDial(v);
                      setPhoneError(null);
                      const c = DIAL_COUNTRIES.find((x) => x.code === v);
                      setPhoneInput(formatNational(v, phoneInput, c?.dial));
                    }}
                  >
                    <SelectTrigger
                      className="h-12 w-[136px] rounded-full"
                      aria-label={t("auth.country_code")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {DIAL_COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.flag} {c.dial}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone-up"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    required
                    maxLength={24}
                    className="h-12 flex-1 rounded-full"
                    placeholder={formatNational(dial, "0".repeat(lens[0] ?? 8))}
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(formatNational(dial, e.target.value, country?.dial));
                      setPhoneError(null);
                    }}
                    onBlur={() => setPhoneError(check.ok ? null : t("auth.invalid_phone"))}
                    aria-invalid={!!phoneError}
                    aria-describedby="phone-help"
                  />
                </div>
                <p
                  id="phone-help"
                  className={`text-xs ${phoneError ? "text-destructive" : "text-foreground/60"}`}
                >
                  {phoneError
                    ? `${phoneError} (${digitsHint} ${t("auth.digits")})`
                    : check.ok
                      ? check.e164
                      : `${t("auth.phone_hint")} · ${digitsHint} ${t("auth.digits")}`}
                </p>
              </div>

              <Field id="email-up" name="email" label={t("auth.email")} type="email" />
              <Field id="pass-up" name="password" label={t("auth.password")} type="password" />
              <Button
                className="press h-12 w-full gap-2 rounded-full bg-primary-foreground text-primary shadow-lift hover:bg-primary-foreground/90"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {t("auth.creating")}
                  </>
                ) : (
                  <>
                    {t("auth.signup")} <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={showForgot}
        onOpenChange={(open) => {
          setShowForgot(open);
          if (!open) setResetSent(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("auth.reset_title")}</DialogTitle>
            <DialogDescription>{t("auth.reset_subtitle")}</DialogDescription>
          </DialogHeader>
          {resetSent ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("auth.reset_link_sent")}</p>
              <Button
                className="press h-11 w-full rounded-full shadow-lift"
                onClick={() => setShowForgot(false)}
              >
                {t("auth.back_to_signin")}
              </Button>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={handleForgotPassword}>
              <Field id="email-forgot" name="email" label={t("auth.email")} type="email" />
              <Button
                className="press h-11 w-full gap-2 rounded-full shadow-lift"
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {t("auth.sending")}
                  </>
                ) : (
                  t("auth.send_reset_link")
                )}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const Icon = isPassword ? Lock : type === "email" ? Mail : User;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name={name}
          type={isPassword && show ? "text" : type}
          required
          maxLength={255}
          className={`h-12 rounded-full pl-11 ${isPassword ? "pr-11" : "pr-4"}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
