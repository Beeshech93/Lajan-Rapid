import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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
      const country = DIAL_COUNTRIES.find((c) => c.code === dial);
      const e164 = toE164(country?.dial ?? "+509", String(form.get("phone") ?? ""));
      if (!e164) {
        toast.error(t("auth.invalid_phone"));
        return;
      }
      phone = e164;
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

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(t("auth.google_error"));
      return;
    }
    if (result.redirected) return;
    router.navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-brand px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher className="h-9 w-[150px] border-white/20 bg-white/10 text-xs text-primary-foreground" />
        </div>
        <div className="mb-6 text-center text-primary-foreground">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-mint font-display text-lg font-bold text-accent-foreground">
            LR
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold">Lajan Rapid</h1>
          <p className="text-sm opacity-80">{t("app.tagline")}</p>
        </div>

        <Card className="shadow-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">{t("auth.welcome")}</CardTitle>
            <CardDescription>{t("auth.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ingreso">{t("auth.signin")}</TabsTrigger>
                <TabsTrigger value="registro">{t("auth.signup")}</TabsTrigger>
              </TabsList>

              <TabsContent value="ingreso">
                <form className="space-y-3" onSubmit={(e) => handle(e, "ingreso")}>
                  <Field id="email-in" name="email" label={t("auth.email")} type="email" />
                  <Field id="pass-in" name="password" label={t("auth.password")} type="password" />
                  <Button className="w-full" disabled={loading}>
                    {loading ? t("auth.entering") : t("auth.enter")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="registro">
                <form className="space-y-3" onSubmit={(e) => handle(e, "registro")}>
                  <Field id="name-up" name="full_name" label={t("auth.fullname")} />

                  <div className="space-y-1.5">
                    <Label htmlFor="phone-up">{t("auth.phone")}</Label>
                    <div className="flex gap-2">
                      <Select value={dial} onValueChange={setDial}>
                        <SelectTrigger className="w-[136px]" aria-label={t("auth.country_code")}>
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
                        maxLength={20}
                        className="flex-1"
                        placeholder="0000 0000"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{t("auth.phone_hint")}</p>
                  </div>

                  <Field id="email-up" name="email" label={t("auth.email")} type="email" />
                  <Field id="pass-up" name="password" label={t("auth.password")} type="password" />
                  <Button className="w-full" disabled={loading}>
                    {loading ? t("auth.creating") : t("auth.signup")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> {t("auth.or")}{" "}
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={google} type="button">
              {t("auth.google")}
            </Button>
          </CardContent>
        </Card>
      </div>
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
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} required maxLength={255} />
    </div>
  );
}
