import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { revealCardDetails } from "@/lib/cards.functions";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Lock, ShieldCheck, Snowflake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/useProfile";
import { money, shortDate } from "@/lib/remesa";
import {
  useCardTransactions,
  useCards,
  useRefreshWallet,
  useWallets,
  type VirtualCard,
} from "@/hooks/useWallet";

export const Route = createFileRoute("/_authenticated/tarjeta")({
  head: () => ({
    meta: [
      { title: "Tarjeta virtual — Lajan Rapid" },
      {
        name: "description",
        content:
          "Emite tu tarjeta virtual Visa o Mastercard, congélala al instante y paga en línea con el saldo de tu billetera.",
      },
      { property: "og:title", content: "Tarjeta virtual — Lajan Rapid" },
      {
        property: "og:description",
        content: "Tarjeta virtual ligada a tu billetera, con límites y control de seguridad.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Tarjeta,
});

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  frozen: "Congelada",
  cancelled: "Cancelada",
};

function Tarjeta() {
  const { profile } = useProfile();
  const { data: wallets } = useWallets();
  const { data: cards } = useCards();
  const { data: txs } = useCardTransactions();
  const refresh = useRefreshWallet();

  const [walletId, setWalletId] = useState("");
  const [brand, setBrand] = useState("visa");
  const [label, setLabel] = useState("");
  const [disposable, setDisposable] = useState(false);
  const [busy, setBusy] = useState(false);

  const approved = profile?.kyc_status === "approved";
  const list = cards ?? [];
  const walletList = wallets ?? [];

  const issue = async () => {
    if (!walletId) {
      toast.error("Elige la billetera que financia la tarjeta");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("issue_virtual_card", {
      _wallet_id: walletId,
      _brand: brand,
      _disposable: disposable,
      ...(label ? { _label: label } : {}),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tarjeta emitida");
    setLabel("");
    refresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Tarjeta virtual</h1>
        <p className="text-sm text-muted-foreground">
          Paga en línea donde acepten Visa o Mastercard, con el saldo de tu billetera.
        </p>
      </header>

      {!approved && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p>
              Necesitas tu verificación de identidad aprobada para emitir una tarjeta. Complétala en
              tu perfil.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tarjetas">
        <TabsList className="flex-wrap">
          <TabsTrigger value="tarjetas">Mis tarjetas</TabsTrigger>
          <TabsTrigger value="emitir">Emitir</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
        </TabsList>

        <TabsContent value="tarjetas" className="mt-4 space-y-4">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no tienes tarjetas emitidas.</p>
          )}
          {list.map((c) => (
            <CardItem key={c.id} card={c} onChange={refresh} />
          ))}
        </TabsContent>

        <TabsContent value="emitir" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4" /> Nueva tarjeta virtual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Billetera</Label>
                  <Select value={walletId} onValueChange={setWalletId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Elige moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      {walletList.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.currency} · {money(Number(w.balance), w.currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Marca</Label>
                  <Select value={brand} onValueChange={setBrand}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visa">Visa</SelectItem>
                      <SelectItem value="mastercard">Mastercard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="card-label">Nombre de la tarjeta (opcional)</Label>
                <Input
                  id="card-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Compras en línea"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Tarjeta desechable</p>
                  <p className="text-xs text-muted-foreground">
                    Se cancela sola después de la primera compra.
                  </p>
                </div>
                <Switch checked={disposable} onCheckedChange={setDisposable} />
              </div>
              <Button className="w-full" disabled={busy || !approved} onClick={issue}>
                Emitir tarjeta
              </Button>
              <p className="text-xs text-muted-foreground">
                Por cumplimiento PCI DSS, el número completo y el CVV nunca se guardan aquí: los
                custodia el proveedor emisor.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compras" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de compras</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(txs ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin compras registradas.</p>
              )}
              {(txs ?? []).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border-b py-2 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{t.merchant}</p>
                    <p className="text-xs text-muted-foreground">
                      {shortDate(t.created_at)}
                      {t.decline_reason ? ` · ${t.decline_reason}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{money(Number(t.amount), t.currency)}</p>
                    <Badge variant={t.status === "approved" ? "secondary" : "destructive"}>
                      {t.status === "approved" ? "Aprobada" : "Rechazada"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CardItem({ card, onChange }: { card: VirtualCard; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  const { data: limits } = useQuery({
    queryKey: ["card_limits", card.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("card_limits")
        .select("*")
        .eq("card_id", card.id)
        .maybeSingle();
      return data;
    },
  });

  const toggleFreeze = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("set_card_status", {
      _card_id: card.id,
      _status: card.status === "active" ? "frozen" : "active",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(card.status === "active" ? "Tarjeta congelada" : "Tarjeta desbloqueada");
    onChange();
  };

  const reveal = useServerFn(revealCardDetails);
  const [secure, setSecure] = useState<{ pan?: string; cvv?: string } | null>(null);
  const [loadingSecure, setLoadingSecure] = useState(false);

  const showFull = async () => {
    setLoadingSecure(true);
    try {
      const res = await reveal({ data: { cardId: card.id } });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron obtener los datos");
        return;
      }
      setSecure({
        ...(res.pan ? { pan: res.pan } : {}),
        ...(res.cvv ? { cvv: res.cvv } : {}),
      });
      setTimeout(() => setSecure(null), 60_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al consultar el emisor");
    } finally {
      setLoadingSecure(false);
    }
  };

  const { profile } = useProfile();
  const { data: wallets } = useWallets();
  const wallet = (wallets ?? []).find((w) => w.id === card.wallet_id);
  const holder = profile?.full_name || "Titular Lajan Rapid";
  const expiry = `${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}`;
  const panText = secure?.pan
    ? secure.pan.replace(/(.{4})/g, "$1 ").trim()
    : `•••• •••• •••• ${card.last4}`;

  const rows: Array<[string, string]> = [
    ["Nombre de la tarjeta", card.label || "Sin nombre"],
    ["Titular", holder],
    ["Marca", card.brand.toUpperCase()],
    ["Número", panText],
    ["Vencimiento", expiry],
    ["CVV", secure?.cvv ?? "Oculto · pulsa «Ver datos completos»"],
    ["Estado", STATUS_LABEL[card.status] ?? card.status],
    ["Tipo", card.is_disposable ? "Desechable (un solo uso)" : "Recargable"],
    [
      "Billetera",
      wallet ? `${wallet.currency} · ${money(Number(wallet.balance), wallet.currency)}` : "—",
    ],
    ["Emisor", card.provider],
    ["Emitida", shortDate(card.created_at)],
    ["ID de tarjeta", card.id],
  ];

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="rounded-2xl bg-sidebar p-5 text-sidebar-foreground">
          <div className="flex items-start justify-between">
            <span className="text-xs uppercase tracking-widest opacity-70">
              {card.label || "Lajan Rapid"}
            </span>
            <span className="font-display text-sm font-semibold uppercase">{card.brand}</span>
          </div>
          <p className="mt-6 font-mono text-lg tracking-[0.3em]">•••• •••• •••• {card.last4}</p>
          <div className="mt-4 flex items-end justify-between gap-3 text-xs">
            <span className="truncate uppercase opacity-80">{holder}</span>
            <span className="opacity-70">Vence {expiry}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={card.status === "active" ? "secondary" : "outline"}>
            {STATUS_LABEL[card.status] ?? card.status}
          </Badge>
          {card.is_disposable && <Badge variant="outline">Desechable</Badge>}
          {card.status !== "cancelled" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={toggleFreeze}>
              {card.status === "active" ? (
                <>
                  <Snowflake className="size-4" /> Congelar
                </>
              ) : (
                <>
                  <Lock className="size-4" /> Desbloquear
                </>
              )}
            </Button>
          )}
          {card.status !== "cancelled" && (
            <Button
              size="sm"
              variant={secure ? "secondary" : "default"}
              disabled={loadingSecure}
              onClick={secure ? () => setSecure(null) : showFull}
            >
              {secure ? (
                <>
                  <EyeOff className="size-4" /> Ocultar datos
                </>
              ) : (
                <>
                  <Eye className="size-4" /> {loadingSecure ? "Consultando…" : "Ver datos completos"}
                </>
              )}
            </Button>
          )}
        </div>

        {secure && (
          <p className="text-xs text-muted-foreground">
            Datos entregados por el emisor en este momento; se ocultan solos en 1 minuto y no se
            guardan en Lajan Rapid.
          </p>
        )}

        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b py-1.5">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="truncate text-right text-xs font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        {limits && (
          <div className="rounded-lg border p-3 text-xs">
            <p className="mb-1 font-medium">Límites</p>
            <p className="text-muted-foreground">
              Por compra: {money(Number(limits.per_transaction), wallet?.currency ?? "USD")} ·
              Diario: {money(Number(limits.daily_limit), wallet?.currency ?? "USD")} · Mensual:{" "}
              {money(Number(limits.monthly_limit), wallet?.currency ?? "USD")}
            </p>
            <p className="text-muted-foreground">
              Compras en línea: {limits.online_enabled ? "activadas" : "desactivadas"}
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Úsala donde quieras: paga en línea o agrégala a Apple Pay / Google Wallet. Las compras se
          descuentan del saldo de tu billetera.
        </p>
      </CardContent>
    </Card>
  );
}
