import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import logoAsset from "@/assets/lajan-rapid-logo.png.asset.json";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/restablecer-password")({
  head: () => ({
    meta: [{ title: "Restablecer contraseña — Lajan Rapid" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // El enlace del correo crea una sesión de recuperación automáticamente
    // al cargar la página (Supabase detecta el token en la URL).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const schema = z
      .object({
        password: z.string().min(8, t("auth.min_password")).max(72),
        confirm: z.string(),
      })
      .refine((d) => d.password === d.confirm, { message: "Las contraseñas no coinciden" });
    const parsed = schema.safeParse({
      password: String(form.get("password") ?? ""),
      confirm: String(form.get("confirm") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("auth.invalid"));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;
      setDone(true);
      toast.success("Contraseña actualizada");
      setTimeout(() => router.navigate({ to: "/dashboard", replace: true }), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-brand px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-foreground">
          <span className="mx-auto grid size-14 place-items-center overflow-hidden rounded-2xl bg-logo-surface p-1.5 shadow-soft">
            <img src={logoAsset.url} alt="Lajan Rapid" className="h-full w-full object-contain" />
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold">Lajan Rapid</h1>
        </div>

        <Card className="shadow-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">{t("auth.reset_title")}</CardTitle>
            <CardDescription>Elige tu nueva contraseña.</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <p className="text-sm text-muted-foreground">
                Tu contraseña fue actualizada. Redirigiendo…
              </p>
            ) : !ready ? (
              <p className="text-sm text-muted-foreground">
                Verificando el enlace de recuperación…
              </p>
            ) : (
              <form className="space-y-3" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input id="password" name="password" type="password" required maxLength={72} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirmar contraseña</Label>
                  <Input id="confirm" name="confirm" type="password" required maxLength={72} />
                </div>
                <Button className="w-full" disabled={loading}>
                  {loading ? "Guardando…" : "Guardar nueva contraseña"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
