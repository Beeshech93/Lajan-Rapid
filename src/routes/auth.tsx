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

const searchSchema = z.object({ modo: z.enum(["ingreso", "registro"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Acceder — RemesaHaití" },
      { name: "description", content: "Inicia sesión o crea tu cuenta para enviar dinero de México a Haití." },
      { property: "og:title", content: "Acceder — RemesaHaití" },
      { property: "og:description", content: "Entra a tu cuenta RemesaHaití y envía dinero a Haití." },
    ],
  }),
  component: AuthPage,
});

const credSchema = z.object({
  email: z.string().trim().email("Correo inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
});

function AuthPage() {
  const router = useRouter();
  const { modo } = Route.useSearch();
  const [tab, setTab] = useState(modo === "registro" ? "registro" : "ingreso");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/dashboard", replace: true });
    });
  }, [router]);

  const handle = async (e: React.FormEvent<HTMLFormElement>, mode: "ingreso" | "registro") => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = credSchema.safeParse({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setLoading(true);
    try {
      if (mode === "registro") {
        const fullName = String(form.get("full_name") ?? "").trim().slice(0, 100);
        const phone = String(form.get("phone") ?? "").trim().slice(0, 25);
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          toast.success("¡Cuenta creada!");
          router.navigate({ to: "/dashboard", replace: true });
        } else {
          toast.success("Revisa tu correo para confirmar la cuenta");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        router.navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos completar la operación");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("No pudimos conectar con Google");
      return;
    }
    if (result.redirected) return;
    router.navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-brand px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-primary-foreground">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-mint font-display text-xl font-bold text-accent-foreground">
            R
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold">RemesaHaití</h1>
          <p className="text-sm opacity-80">México → Haití, sin sorpresas</p>
        </div>

        <Card className="shadow-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Bienvenido</CardTitle>
            <CardDescription>Accede o crea tu cuenta en un minuto.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ingreso">Iniciar sesión</TabsTrigger>
                <TabsTrigger value="registro">Crear cuenta</TabsTrigger>
              </TabsList>

              <TabsContent value="ingreso">
                <form className="space-y-3" onSubmit={(e) => handle(e, "ingreso")}>
                  <Field id="email-in" name="email" label="Correo" type="email" />
                  <Field id="pass-in" name="password" label="Contraseña" type="password" />
                  <Button className="w-full" disabled={loading}>
                    {loading ? "Entrando…" : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="registro">
                <form className="space-y-3" onSubmit={(e) => handle(e, "registro")}>
                  <Field id="name-up" name="full_name" label="Nombre completo" />
                  <Field id="phone-up" name="phone" label="Teléfono (México)" type="tel" />
                  <Field id="email-up" name="email" label="Correo" type="email" />
                  <Field id="pass-up" name="password" label="Contraseña" type="password" />
                  <Button className="w-full" disabled={loading}>
                    {loading ? "Creando…" : "Crear cuenta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> o <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={google} type="button">
              Continuar con Google
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
