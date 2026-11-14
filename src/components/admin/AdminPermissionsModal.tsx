import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  User,
  Users,
  Check,
  CheckSquare,
  Square,
  Lock,
  Sparkles,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  setUserRoleAndPermissions,
  type AdminTabId,
  type AdminPermissionsConfig,
  ALL_ADMIN_TAB_IDS,
} from "@/lib/admin-permissions.functions";

interface TabMeta {
  id: AdminTabId;
  label: string;
  desc: string;
  category: "operaciones" | "finanzas" | "configuracion" | "integraciones" | "sistema";
}

const TAB_METAS: TabMeta[] = [
  // Operaciones
  { id: "tx", label: "Transacciones", desc: "Aprobar, ver y cancelar envíos de dinero", category: "operaciones" },
  { id: "recargas", label: "Recargas móviles", desc: "Historial, detalles y reintento de recargas", category: "operaciones" },
  { id: "kyc", label: "Validación KYC", desc: "Revisar, aprobar o rechazar identificaciones", category: "operaciones" },
  { id: "soporte", label: "Soporte al cliente", desc: "Ver y responder tickets de soporte", category: "operaciones" },
  { id: "bulk-email", label: "Correo masivo", desc: "Enviar comunicados por correo a clientes", category: "operaciones" },
  { id: "operators", label: "Reporte operadores", desc: "Métricas por operador telefónico", category: "operaciones" },

  // Finanzas
  { id: "resumen", label: "Resumen y Métricas", desc: "KPIs, volumen y gráficos generales", category: "finanzas" },
  { id: "contabilidad", label: "Contabilidad", desc: "Billeteras, saldos de clientes y recargas", category: "finanzas" },
  { id: "tarifas", label: "Tarifas de remesas", desc: "Tasas de cambio y comisiones de envío", category: "finanzas" },
  { id: "topup-rates", label: "Tasas de recargas", desc: "Márgenes y tasas para recargas Ding", category: "finanzas" },
  { id: "cripto", label: "Criptomonedas", desc: "Billeteras cripto y depósitos", category: "finanzas" },

  // Configuración
  { id: "servicios", label: "Control de Servicios", desc: "Habilitar/deshabilitar envíos, recargas o cripto", category: "configuracion" },
  { id: "banner", label: "Banner Promocional", desc: "Gestionar anuncios y avisos en la web", category: "configuracion" },

  // Integraciones
  { id: "mercadopago", label: "Mercado Pago", desc: "Credenciales y cobros en México", category: "integraciones" },
  { id: "stripe", label: "Stripe", desc: "Pasarela para tarjetas internacionales", category: "integraciones" },
  { id: "dingconnect", label: "DingConnect", desc: "Conexión para recargas de saldo", category: "integraciones" },
  { id: "bazik", label: "Bazik API", desc: "Dispersión a MonCash y NatCash", category: "integraciones" },
  { id: "resend", label: "Servicio de Correo", desc: "API key de Resend y remitente", category: "integraciones" },

  // Sistema
  { id: "usuarios", label: "Gestión de Usuarios", desc: "Asignar roles y restringir permisos a otros admins", category: "sistema" },
  { id: "security", label: "Seguridad y Auditoría", desc: "Logs de seguridad y bloqueos", category: "sistema" },
  { id: "migracion", label: "Migración IA", desc: "Herramienta de migración asistida", category: "sistema" },
];

const CATEGORY_TITLES = {
  operaciones: "Operaciones y Clientes",
  finanzas: "Finanzas y Tasas",
  configuracion: "Configuración General",
  integraciones: "Integraciones y Pasarelas",
  sistema: "Seguridad y Administración",
};

const OPERATIONAL_TABS: AdminTabId[] = ["tx", "recargas", "kyc", "soporte", "operators"];

interface AdminPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    full_name?: string | null;
    phone?: string | null;
  } | null;
  currentRole: "admin" | "agent" | "client";
  currentPerms?: AdminPermissionsConfig | null;
}

export function AdminPermissionsModal({
  isOpen,
  onClose,
  user,
  currentRole,
  currentPerms,
}: AdminPermissionsModalProps) {
  const qc = useQueryClient();
  const saveRoleAndPerms = useServerFn(setUserRoleAndPermissions);

  const [role, setRole] = useState<"admin" | "agent" | "client">(currentRole);
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);
  const [selectedTabs, setSelectedTabs] = useState<AdminTabId[]>(ALL_ADMIN_TAB_IDS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setRole(currentRole);
      if (currentRole === "admin") {
        const isSuper = currentPerms ? currentPerms.isSuperAdmin : true;
        setIsSuperAdmin(isSuper);
        setSelectedTabs(currentPerms?.allowedTabs?.length ? currentPerms.allowedTabs : ALL_ADMIN_TAB_IDS);
      } else {
        setIsSuperAdmin(false);
        setSelectedTabs(OPERATIONAL_TABS);
      }
    }
  }, [user, currentRole, currentPerms]);

  if (!user) return null;

  const toggleTab = (id: AdminTabId) => {
    setSelectedTabs((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => setSelectedTabs([...ALL_ADMIN_TAB_IDS]);
  const handleSelectOps = () => setSelectedTabs([...OPERATIONAL_TABS]);
  const handleClearAll = () => setSelectedTabs([]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveRoleAndPerms({
        data: {
          targetUserId: user.id,
          role,
          isSuperAdmin: role === "admin" ? isSuperAdmin : false,
          allowedTabs: role === "admin" ? (isSuperAdmin ? ALL_ADMIN_TAB_IDS : selectedTabs) : [],
        },
      });

      toast.success("Rol y permisos actualizados correctamente");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["all-admins-permissions"] });
      qc.invalidateQueries({ queryKey: ["my-admin-permissions"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo actualizar los permisos");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Shield className="size-5 text-primary" />
            Configurar Rol y Permisos
          </DialogTitle>
          <DialogDescription>
            Administra los privilegios de acceso y restricciones para{" "}
            <span className="font-semibold text-foreground">
              {user.full_name || user.phone || user.id}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 1. Selector de Rol */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Seleccionar Rol del Usuario
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Cliente */}
              <button
                type="button"
                onClick={() => setRole("client")}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  role === "client"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-border/60 hover:border-border hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <User className="size-5 text-muted-foreground" />
                  {role === "client" && <Check className="size-4 text-primary" />}
                </div>
                <p className="font-bold text-sm mt-2">Cliente</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Usuario regular sin acceso administrativo.
                </p>
              </button>

              {/* Agente */}
              <button
                type="button"
                onClick={() => setRole("agent")}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  role === "agent"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-border/60 hover:border-border hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Users className="size-5 text-amber-500" />
                  {role === "agent" && <Check className="size-4 text-primary" />}
                </div>
                <p className="font-bold text-sm mt-2">Agente</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Acceso al portal de agentes para cobrar/enviar.
                </p>
              </button>

              {/* Administrador */}
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  role === "admin"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-border/60 hover:border-border hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <ShieldCheck className="size-5 text-primary" />
                  {role === "admin" && <Check className="size-4 text-primary" />}
                </div>
                <p className="font-bold text-sm mt-2">Administrador</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Acceso al panel administrativo con o sin restricciones.
                </p>
              </button>
            </div>
          </div>

          {/* 2. Opciones de Administrador (Super Admin vs Restringido) */}
          {role === "admin" && (
            <div className="space-y-4 rounded-2xl bg-secondary/30 p-4 border border-border/50 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="super-admin-switch" className="font-bold text-base cursor-pointer">
                      Super Administrador (Acceso Total)
                    </Label>
                    {isSuperAdmin && (
                      <Badge className="bg-amber-500/15 text-amber-500 hover:bg-amber-500/20 border-amber-500/30 gap-1 text-[11px]">
                        <Sparkles className="size-3" /> Sin límites
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isSuperAdmin
                      ? "Tiene acceso irrestricto a todos los módulos y herramientas del panel."
                      : "Restringido: solo tendrá acceso a los módulos seleccionados abajo."}
                  </p>
                </div>
                <Switch
                  id="super-admin-switch"
                  checked={isSuperAdmin}
                  onCheckedChange={setIsSuperAdmin}
                />
              </div>

              {/* Selector de permisos granulares si NO es Super Admin */}
              {!isSuperAdmin && (
                <div className="space-y-4 pt-3 border-t border-border/50 animate-in fade-in duration-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Módulos permitidos ({selectedTabs.length} de {ALL_ADMIN_TAB_IDS.length})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Los módulos desmarcados no aparecerán para este administrador.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSelectAll}>
                        Todos
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSelectOps}>
                        Solo Operaciones
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={handleClearAll}>
                        Limpiar
                      </Button>
                    </div>
                  </div>

                  {/* Lista de módulos por categoría */}
                  {(["operaciones", "finanzas", "configuracion", "integraciones", "sistema"] as const).map(
                    (cat) => {
                      const items = TAB_METAS.filter((m) => m.category === cat);
                      return (
                        <div key={cat} className="space-y-2">
                          <p className="text-xs font-bold text-foreground/80 flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-primary" />
                            {CATEGORY_TITLES[cat]}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {items.map((tab) => {
                              const checked = selectedTabs.includes(tab.id);
                              return (
                                <button
                                  key={tab.id}
                                  type="button"
                                  onClick={() => toggleTab(tab.id)}
                                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                                    checked
                                      ? "border-primary/60 bg-primary/5 text-foreground"
                                      : "border-border/40 text-muted-foreground hover:bg-secondary/40"
                                  }`}
                                >
                                  <div className="mt-0.5 shrink-0">
                                    {checked ? (
                                      <CheckSquare className="size-4 text-primary" />
                                    ) : (
                                      <Square className="size-4 text-muted-foreground/60" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-xs text-foreground leading-tight">
                                      {tab.label}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                                      {tab.desc}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-primary text-primary-foreground font-bold">
            {isSaving ? "Guardando..." : "Guardar Permisos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
