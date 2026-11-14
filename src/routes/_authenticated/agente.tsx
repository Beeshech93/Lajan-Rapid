import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  XCircle,
  Banknote,
  PlusCircle,
  Search,
  CheckCircle2,
  Clock,
  Coins,
  ShieldCheck,
  Info,
  DollarSign,
  Send,
  Building,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  adminCancelTransfer,
  adminConfirmTransfer,
  adminSetTransferStatus,
  agentCreateCashTransfer,
  agentConfirmCashPayment,
} from "@/lib/transfers.functions";
import { useCountries, useRate, fallbackRate } from "@/hooks/useCorridors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  STATUS_LABEL,
  STATUS_TONE,
  deliveryMethods,
  citiesFor,
  quote,
  money,
  shortDate,
  type TransferStatus,
} from "@/lib/remesa";

const ALL_STATUSES: TransferStatus[] = [
  "created",
  "awaiting_payment",
  "paid",
  "processing",
  "ready_for_pickup",
  "completed",
  "cancelled",
];

export const Route = createFileRoute("/_authenticated/agente")({
  head: () => ({
    meta: [
      { title: "Panel de Agente Independiente — Lajan Rapid" },
      { name: "description", content: "Ventanilla de transacciones en efectivo y comisiones de agente." },
      { property: "og:title", content: "Panel de Agente Independiente — Lajan Rapid" },
      { property: "og:description", content: "Gestión autónoma de transacciones en efectivo y comisiones." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const email = (data.user.email ?? "").toLowerCase().trim();
    if (email === "lajanrapid26@gmail.com") {
      return;
    }
    let allowed = false;
    let isAdmin = false;
    try {
      const { data: agentRole } = await supabase.rpc("has_role", {
        _user_id: data.user.id,
        _role: "agent",
      });
      if (agentRole) allowed = true;
      const { data: adminRole } = await supabase.rpc("has_role", {
        _user_id: data.user.id,
        _role: "admin",
      });
      if (adminRole) isAdmin = true;
    } catch {
      // ignore
    }
    if (!allowed && !isAdmin) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .in("role", ["admin", "agent"])
        .maybeSingle();
      if (roleRow) {
        if (roleRow.role === "admin") isAdmin = true;
        if (roleRow.role === "agent") allowed = true;
      }
    }
    if (!allowed && !isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: Agente,
});

function Agente() {
  const { user, profile, isAdmin } = useProfile();
  const qc = useQueryClient();
  const confirmTransfer = useServerFn(adminConfirmTransfer);
  const setStatus = useServerFn(adminSetTransferStatus);
  const cancelTransfer = useServerFn(adminCancelTransfer);
  const createCashTransfer = useServerFn(agentCreateCashTransfer);
  const confirmCashByRef = useServerFn(agentConfirmCashPayment);

  const { data: countries } = useCountries();

  // Estados de control para modales
  const [openNewCashModal, setOpenNewCashModal] = useState(false);
  const [openClaimModal, setOpenClaimModal] = useState(false);
  const [claimReference, setClaimReference] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Formulario de nueva transacción en efectivo (ventanilla)
  const [originCountry, setOriginCountry] = useState("DO");
  const [destinationCountry] = useState("HT");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientCity, setRecipientCity] = useState("Port-au-Prince");
  const [deliveryMethod, setDeliveryMethod] = useState("moncash");
  const [amountSend, setAmountSend] = useState("");
  const [note, setNote] = useState("");
  const [isSubmittingCash, setIsSubmittingCash] = useState(false);

  // Cotización en tiempo real para la ventanilla en efectivo
  const origins = useMemo(() => (countries ?? []).filter((c) => c.is_origin), [countries]);
  const activeOrigin = useMemo(() => origins.find((c) => c.code === originCountry) ?? origins[0], [origins, originCountry]);
  const sendCur = activeOrigin?.currency ?? "DOP";
  const recvCur = "HTG";

  const { data: corridorRate } = useRate(sendCur, recvCur);
  const effectiveCfg = corridorRate && Number(corridorRate.rate) > 0 ? corridorRate : (fallbackRate(sendCur, recvCur) ?? {
    rate: 2.20,
    fee_percent: 2.5,
    fee_fixed: 50,
    agent_commission_percent: 1.0,
  });

  const parsedAmount = Number(amountSend) || 0;
  const q = quote(parsedAmount, effectiveCfg);

  // Cada agente consulta de forma independiente sus transacciones y pendientes en efectivo
  const { data: transfers, isLoading } = useQuery({
    queryKey: ["agent-transfers", user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("transfers")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isAdmin && user?.id) {
        // Un agente independiente ve sus propias operaciones y solicitudes en efectivo pendientes
        query = query.or(
          `agent_id.eq.${user.id},user_id.eq.${user.id},and(status.eq.awaiting_payment,payment_method.eq.cash_agent)`
        );
      }

      const { data } = await query.limit(100);
      return (data as Row[]) ?? [];
    },
    enabled: Boolean(user?.id),
  });

  const advance = async (id: string, status: TransferStatus, message: string) => {
    try {
      const result = await confirmTransfer({ data: { transferId: id } });
      if (result.ok) {
        toast.success(result.message || message);
        qc.invalidateQueries({ queryKey: ["agent-transfers"] });
      } else {
        toast.error("No se pudo actualizar");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar");
    }
  };

  const changeStage = async (id: string, status: TransferStatus) => {
    try {
      const result = await setStatus({ data: { transferId: id, status } });
      toast.success(result.message);
      qc.invalidateQueries({ queryKey: ["agent-transfers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar la etapa");
    }
  };

  const cancel = async (id: string, reason: string) => {
    try {
      const result = await cancelTransfer({
        data: { transferId: id, reason: reason || undefined },
      });
      toast.success(result.message);
      qc.invalidateQueries({ queryKey: ["agent-transfers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar");
    }
  };

  // Enviar nueva transacción en efectivo (ventanilla)
  const handleCreateCashTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      toast.error("Ingresa un monto en efectivo válido.");
      return;
    }
    if (!recipientName.trim()) {
      toast.error("Ingresa el nombre completo del destinatario.");
      return;
    }
    if (!recipientPhone.trim()) {
      toast.error("Ingresa el teléfono del destinatario.");
      return;
    }

    if (deliveryMethod === "moncash" && q.receives > 75000) {
      toast.error("MonCash permite un máximo de 75,000 HTG.");
      return;
    }
    if (deliveryMethod === "natcash" && (q.receives < 3998 || q.receives > 75000)) {
      toast.error("NatCash requiere entre 3,998 y 75,000 HTG.");
      return;
    }

    setIsSubmittingCash(true);
    try {
      const res = await createCashTransfer({
        data: {
          originCountry,
          destinationCountry: "HT",
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          recipientCity,
          deliveryMethod,
          amountSend: parsedAmount,
          note: note.trim() || undefined,
        },
      });

      if (res.ok) {
        toast.success(`¡Transacción ${res.reference} cobrada en efectivo exitosamente!`);
        setOpenNewCashModal(false);
        setRecipientName("");
        setRecipientPhone("");
        setAmountSend("");
        setNote("");
        qc.invalidateQueries({ queryKey: ["agent-transfers"] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar la transacción en efectivo");
    } finally {
      setIsSubmittingCash(false);
    }
  };

  // Cobrar envío existente que un cliente generó con pago en efectivo
  const handleClaimByReference = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = claimReference.trim();
    if (!ref) {
      toast.error("Ingresa el código de referencia.");
      return;
    }

    setIsClaiming(true);
    try {
      const res = await confirmCashByRef({ data: { reference: ref } });
      if (res.ok) {
        toast.success(res.message);
        setClaimReference("");
        setOpenClaimModal(false);
        qc.invalidateQueries({ queryKey: ["agent-transfers"] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cobrar la referencia");
    } finally {
      setIsClaiming(false);
    }
  };

  const rows = transfers ?? [];

  // Filtrado de búsqueda
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter(
      (t) =>
        t.reference.toLowerCase().includes(q) ||
        t.recipient_name.toLowerCase().includes(q) ||
        t.recipient_phone.toLowerCase().includes(q) ||
        t.recipient_city.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  // Mis operaciones como agente independiente
  const myOperations = filteredRows.filter(
    (t) => t.agent_id === user?.id || (isAdmin && t.agent_id)
  );

  // Solicitudes en efectivo pendientes por cobrar en ventanilla
  const pendingCashPickups = filteredRows.filter(
    (t) => t.status === "awaiting_payment" && t.payment_method === "cash_agent"
  );

  // Operaciones activas en proceso
  const activeOperations = myOperations.filter(
    (t) => t.status === "processing" || t.status === "paid" || t.status === "ready_for_pickup"
  );

  // Historial completado
  const completedOperations = myOperations.filter((t) => t.status === "completed");

  // Suma total de efectivo recaudado por este agente
  const totalCashCollected = myOperations
    .filter((t) => t.payment_method === "cash_agent" && t.status !== "cancelled")
    .reduce((acc, t) => {
      const cur = t.send_currency;
      acc[cur] = (acc[cur] ?? 0) + Number(t.total_send ?? 0);
      return acc;
    }, {} as Record<string, number>);

  const totalCashLabel =
    Object.keys(totalCashCollected).length === 0
      ? "0.00"
      : Object.entries(totalCashCollected)
          .map(([cur, val]) => money(val, cur))
          .join(" · ");

  // Comisiones acumuladas ganadas por este agente
  const commissions = myOperations
    .filter((t) => t.status !== "cancelled")
    .reduce((acc, t) => {
      const cur = t.send_currency;
      acc[cur] = (acc[cur] ?? 0) + Number(t.agent_commission_send ?? 0);
      return acc;
    }, {} as Record<string, number>);

  const commissionsLabel =
    Object.keys(commissions).length === 0
      ? "0.00"
      : Object.entries(commissions)
          .map(([cur, val]) => money(val, cur))
          .join(" · ");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Volver al inicio"
          >
            <Link to="/dashboard">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Panel de Agente Independiente</h1>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold">
                Solo Efectivo
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Gestión de ventanilla, transacciones en efectivo y comisiones de tu agencia.
            </p>
          </div>
        </div>

        {/* Botones de Acción Rápida */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setOpenClaimModal(true)}
            variant="outline"
            className="gap-2 border-emerald-500/30 hover:bg-emerald-500/10 text-xs sm:text-sm"
          >
            <Search className="size-4 text-emerald-400" />
            <span>Cobrar con Referencia</span>
          </Button>

          <Button
            onClick={() => setOpenNewCashModal(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md text-xs sm:text-sm"
          >
            <PlusCircle className="size-4" />
            <span>Nueva Operación en Efectivo</span>
          </Button>
        </div>
      </div>

      {/* Regla y Aviso Oficial de Agentes: Solo Efectivo & Independencia */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-emerald-200/90 shadow-sm flex items-start gap-3">
        <Banknote className="size-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm leading-relaxed space-y-1">
          <p className="font-semibold text-white">
            Operaciones Exclusivas en Efectivo
          </p>
          <p className="text-emerald-200/80">
            Cada agente opera de forma independiente y autónoma con sus servicios. Los agentes <strong>solo reciben efectivo en mano</strong> para realizar o cobrar transacciones. Todas las operaciones procesadas generan comisiones directas e independientes para tu punto de servicio.
          </p>
        </div>
      </div>

      {/* Tarjetas KPI de Rendimiento del Agente */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard
          icon={Banknote}
          label="Efectivo Cobrado en Ventanilla"
          value={totalCashLabel}
          tone="text-emerald-400"
          hint="Monto total en efectivo recibido"
        />
        <StatCard
          icon={Coins}
          label="Comisiones Ganadas"
          value={commissionsLabel}
          tone="text-primary font-bold"
          hint="Ganancia acumulada por tus envíos"
        />
        <StatCard
          icon={Clock}
          label="Operaciones en Curso"
          value={String(activeOperations.length)}
          hint="En proceso o entrega"
        />
        <StatCard
          icon={CheckCircle2}
          label="Operaciones Completadas"
          value={String(completedOperations.length)}
          hint="Entregadas exitosamente"
        />
      </div>

      {/* Buscador de Envíos */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por referencia (ej. LR-...), nombre o teléfono..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-card/60"
        />
      </div>

      {/* Pestañas de Gestión de Envíos */}
      <Tabs defaultValue="my_operations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="my_operations">
            Mis Operaciones ({myOperations.length})
          </TabsTrigger>
          <TabsTrigger value="pending_cash">
            Pendientes por Cobrar ({pendingCashPickups.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Historial y Comisiones ({completedOperations.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Mis Operaciones */}
        <TabsContent value="my_operations" className="space-y-3">
          <Section
            title="Operaciones Gestionadas por tu Agencia"
            description="Envíos registrados o cobrados en efectivo por tu punto de atención."
            rows={myOperations}
            advance={advance}
            changeStage={changeStage}
            cancel={cancel}
            isAdmin={isAdmin}
            currentUserId={user?.id}
          />
        </TabsContent>

        {/* Tab 2: Pendientes por Cobrar en Ventanilla */}
        <TabsContent value="pending_cash" className="space-y-3">
          <Section
            title="Solicitudes Pendientes de Cobro en Efectivo"
            description="Clientes que crearon un envío para pagar en efectivo en una agencia autorizada."
            rows={pendingCashPickups}
            advance={advance}
            changeStage={changeStage}
            cancel={cancel}
            isAdmin={isAdmin}
            currentUserId={user?.id}
            isClaimView
          />
        </TabsContent>

        {/* Tab 3: Historial y Comisiones */}
        <TabsContent value="history" className="space-y-3">
          <Section
            title="Historial de Operaciones Entregadas"
            description="Transacciones completadas con el desglose de comisión recibida."
            rows={completedOperations}
            advance={advance}
            changeStage={changeStage}
            cancel={cancel}
            isAdmin={isAdmin}
            currentUserId={user?.id}
            readOnly
          />
        </TabsContent>
      </Tabs>

      {/* Modal: Nueva Transacción en Efectivo en Ventanilla */}
      <Dialog open={openNewCashModal} onOpenChange={setOpenNewCashModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Banknote className="size-5 text-emerald-400" />
              Nueva Transacción en Efectivo
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ventanilla de agente: Recibe el efectivo en mano y registra el envío hacia Haití.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCashTransfer} className="space-y-4 pt-2">
            {/* Aviso Solo Efectivo */}
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-emerald-400" />
              <span>
                <strong>Solo Efectivo:</strong> Debes cobrar el importe físico directamente al cliente en tu ventanilla antes de confirmar.
              </span>
            </div>

            {/* País de Origen del Agente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">País de Origen (Moneda de cobro)</Label>
              <Select value={originCountry} onValueChange={setOriginCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {origins.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Datos del Destinatario en Haití */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="recipientName" className="text-xs font-semibold">
                  Nombre Completo del Destinatario
                </Label>
                <Input
                  id="recipientName"
                  placeholder="Ej. Jean-Baptiste Pierre"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="recipientPhone" className="text-xs font-semibold">
                  Teléfono (Haití +509)
                </Label>
                <Input
                  id="recipientPhone"
                  placeholder="509XXXXXXXX"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ciudad de Entrega</Label>
                <Select value={recipientCity} onValueChange={setRecipientCity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {citiesFor("HT").map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Método de Entrega en Haití */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Método de Entrega en Haití</Label>
              <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {deliveryMethods("HT").map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label} — {d.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monto Recibido en Efectivo */}
            <div className="space-y-1.5">
              <Label htmlFor="amountSend" className="text-xs font-semibold">
                Monto en Efectivo a Enviar ({sendCur})
              </Label>
              <Input
                id="amountSend"
                type="number"
                step="any"
                min="1"
                placeholder={`0.00 ${sendCur}`}
                value={amountSend}
                onChange={(e) => setAmountSend(e.target.value)}
                required
                className="font-bold text-base"
              />
            </div>

            {/* Desglose de cotización en tiempo real */}
            {parsedAmount > 0 && (
              <div className="rounded-2xl border border-border/80 bg-secondary/40 p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tasa de cambio:</span>
                  <span className="font-semibold">
                    1 {sendCur} = {Number(effectiveCfg.rate).toFixed(4)} {recvCur}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tarifa de envío:</span>
                  <span>{money(q.fee, sendCur)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-border pt-1.5 text-sm">
                  <span>Total en Efectivo a Cobrar:</span>
                  <span className="text-emerald-400">{money(q.total, sendCur)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-primary">
                  <span>Destinatario Recibe en Haití:</span>
                  <span>{money(q.receives, recvCur)}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1.5 text-emerald-300 font-medium">
                  <span>Tu Comisión como Agente:</span>
                  <span>+{money(q.commission, sendCur)}</span>
                </div>
                <div className="pt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="size-3 text-emerald-400" />
                  <span>Método de pago: <strong>Efectivo en Ventanilla (cash_agent)</strong></span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-xs">Nota interna (Opcional)</Label>
              <Textarea
                id="note"
                rows={2}
                placeholder="Observación o detalle del cliente..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenNewCashModal(false)}
                disabled={isSubmittingCash}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingCash || parsedAmount <= 0}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <Banknote className="size-4" />
                {isSubmittingCash ? "Registrando..." : "Cobrar en Efectivo y Procesar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Cobrar con Código de Referencia */}
      <Dialog open={openClaimModal} onOpenChange={setOpenClaimModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="size-5 text-emerald-400" />
              Cobrar Transferencia con Referencia
            </DialogTitle>
            <DialogDescription className="text-xs">
              Si un cliente creó un envío en la app y seleccionó &ldquo;Efectivo con agente&rdquo;, ingresa su código de referencia para cobrar el efectivo en ventanilla y procesarlo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleClaimByReference} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="claimReference" className="text-xs font-semibold">
                Código de Referencia (Ej. LR-123456)
              </Label>
              <Input
                id="claimReference"
                placeholder="LR-..."
                value={claimReference}
                onChange={(e) => setClaimReference(e.target.value.toUpperCase())}
                required
                className="font-mono text-base uppercase"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenClaimModal(false)}
                disabled={isClaiming}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isClaiming || !claimReference.trim()}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <CheckCircle2 className="size-4" />
                {isClaiming ? "Buscando..." : "Confirmar Cobro en Efectivo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Row = {
  id: string;
  reference: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_city: string;
  amount_send: number;
  total_send: number;
  amount_receive: number;
  send_currency: string;
  receive_currency: string;
  origin_country: string;
  destination_country: string;
  delivery_method: string;
  payment_method: string;
  agent_id: string | null;
  agent_commission_send: number | null;
  status: string;
  created_at: string;
};

function Section({
  title,
  description,
  rows,
  advance,
  changeStage,
  cancel,
  readOnly,
  isAdmin,
  currentUserId,
  isClaimView,
}: {
  title: string;
  description?: string;
  rows: Row[];
  advance: (id: string, status: TransferStatus, message: string) => Promise<void>;
  changeStage: (id: string, status: TransferStatus) => Promise<void>;
  cancel: (id: string, reason: string) => Promise<void>;
  readOnly?: boolean | undefined;
  isAdmin?: boolean | undefined;
  currentUserId?: string | undefined;
  isClaimView?: boolean | undefined;
}) {
  const getAction = (t: Row) => {
    if (t.status === "awaiting_payment") {
      return { to: "processing" as TransferStatus, label: "Confirmar cobro en efectivo" };
    }
    if (t.status === "processing" || t.status === "paid") {
      return { to: "completed" as TransferStatus, label: "Confirmar entrega completada" };
    }
    return undefined;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No hay operaciones en esta sección.
          </div>
        )}
        {rows.map((t) => {
          const action = getAction(t);
          const isMyAgentTransfer = t.agent_id === currentUserId || isAdmin;

          return (
            <div
              key={t.id}
              className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/60 p-4 transition-all hover:bg-card/90 sm:flex-row sm:items-center sm:justify-between"
            >
              {/* Información del Destinatario y Origen/Destino */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground text-sm sm:text-base">
                    {t.recipient_name}
                  </p>
                  <span className="text-xs text-muted-foreground">({t.recipient_city})</span>
                  {t.payment_method === "cash_agent" && (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px] font-semibold py-0.5">
                      💵 Efectivo en Ventanilla
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                  <span className="font-mono font-medium text-foreground">{t.reference}</span>
                  <span>·</span>
                  <span>{t.origin_country} → {t.destination_country}</span>
                  <span>·</span>
                  <span>Entrega: {t.delivery_method}</span>
                  <span>·</span>
                  <span>{shortDate(t.created_at)}</span>
                </p>

                {Number(t.agent_commission_send ?? 0) > 0 && (
                  <p className="text-xs font-semibold text-emerald-400">
                    Comisión ganada: +{money(Number(t.agent_commission_send), t.send_currency)}
                  </p>
                )}
              </div>

              {/* Montos y Estado */}
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <div className="text-left sm:text-right">
                  <p className="font-bold text-foreground text-sm sm:text-base">
                    {money(Number(t.total_send || t.amount_send), t.send_currency)}
                  </p>
                  <p className="text-xs font-medium text-primary">
                    Recibe: {money(Number(t.amount_receive), t.receive_currency)}
                  </p>
                </div>

                <Badge className={STATUS_TONE[t.status as TransferStatus]} variant="secondary">
                  {STATUS_LABEL[t.status as TransferStatus]}
                </Badge>

                {/* Botón de Acción Principal para el Agente */}
                {!readOnly && action && (isMyAgentTransfer || isClaimView) && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm"
                    onClick={() => void advance(t.id, action.to, action.label)}
                  >
                    <CheckCircle2 className="size-3.5" />
                    {action.label}
                  </Button>
                )}

                {/* Cambio manual de etapa */}
                {!readOnly && (isAdmin || isMyAgentTransfer) && (
                  <Select
                    value={t.status}
                    onValueChange={(value) => void changeStage(t.id, value as TransferStatus)}
                  >
                    <SelectTrigger className="h-8 w-[130px] text-xs">
                      <SelectValue placeholder="Cambiar" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Cancelar transacción */}
                {!readOnly && (isAdmin || isMyAgentTransfer) && t.status !== "cancelled" && t.status !== "completed" && (
                  <CancelButton
                    reference={t.reference}
                    onConfirm={(reason) => cancel(t.id, reason)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CancelButton({
  reference,
  onConfirm,
}: {
  reference: string;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" className="h-8 px-2.5 text-xs gap-1">
          <XCircle className="size-3.5" /> Cancelar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar el envío {reference}</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción marcará el envío como cancelado y se registrará en el historial de tu agencia.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder="Motivo de la cancelación (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setReason("")}>Volver</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              void onConfirm(reason);
              setReason("");
            }}
          >
            Sí, cancelar envío
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "text-foreground",
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/70">
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <Icon className="size-4 text-muted-foreground/60" />
        </div>
        <p className={`font-display text-xl font-bold tracking-tight ${tone}`}>{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
      </CardContent>
    </Card>
  );
}
