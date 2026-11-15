import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Palette,
  Globe,
  Settings,
  Shield,
  ShieldCheck,
  Copy,
  ExternalLink,
  Trash2,
  Edit,
  Check,
  Sparkles,
  Layers,
  Phone,
  Mail,
  Sliders,
  DollarSign,
  Smartphone,
  Eye,
  RefreshCw,
  Users,
  UserPlus,
} from "lucide-react";

import {
  type Tenant,
  type TenantBranding,
  type TenantContent,
  type TenantSettings,
  THEME_PRESETS,
  DEFAULT_LAJAN_RAPID_TENANT,
} from "@/lib/whitelabel.types";
import {
  getWhiteLabelTenants,
  saveWhiteLabelTenant,
  deleteWhiteLabelTenant,
} from "@/lib/whitelabel.functions";
import { getAllAdminsPermissionsMap } from "@/lib/admin-permissions.functions";
import { AdminPermissionsModal } from "./AdminPermissionsModal";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/useBrand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export function WhiteLabelPanel() {
  const queryClient = useQueryClient();
  const { currentBrand, switchBrand, resetToDefault } = useBrand();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [managingAdminsTenant, setManagingAdminsTenant] = useState<Tenant | null>(null);
  const [adminUserToEdit, setAdminUserToEdit] = useState<{
    id: string;
    full_name?: string | null;
    phone?: string | null;
  } | null>(null);
  const [selectedUserToAssign, setSelectedUserToAssign] = useState<string>("");

  const fetchAdminsMap = useServerFn(getAllAdminsPermissionsMap);
  const { data: adminsMap = {} } = useQuery({
    queryKey: ["all-admins-permissions"],
    queryFn: () => fetchAdminsMap(),
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, phone, kyc_status, created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      return data ?? [];
    },
  });

  const getTenantAdmins = (tenant: Tenant) => {
    return allProfiles.filter((p) => {
      const isUserAdmin = userRoles.some((r) => r.user_id === p.id && r.role === "admin");
      if (!isUserAdmin) return false;
      const perms = adminsMap[p.id];
      if (tenant.isDefault || tenant.slug === "default") {
        return !perms?.tenantId || perms?.tenantId === tenant.id || perms?.isSuperAdmin;
      }
      return perms?.tenantId === tenant.id || perms?.tenantSlug === tenant.slug;
    });
  };

  // Formulario local
  const [formSlug, setFormSlug] = useState("");
  const [formName, setFormName] = useState("");
  const [formLegalName, setFormLegalName] = useState("");
  const [formDomain, setFormDomain] = useState("");
  const [formSubdomain, setFormSubdomain] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Branding
  const [formBranding, setFormBranding] = useState<TenantBranding>({
    ...DEFAULT_LAJAN_RAPID_TENANT.branding,
  });

  // Content
  const [formContent, setFormContent] = useState<TenantContent>({
    ...DEFAULT_LAJAN_RAPID_TENANT.content,
  });

  // Settings
  const [formSettings, setFormSettings] = useState<TenantSettings>({
    ...DEFAULT_LAJAN_RAPID_TENANT.settings,
  });

  // Consulta de tenants
  const { data: tenants = [], isLoading, refetch } = useQuery({
    queryKey: ["white-label-tenants"],
    queryFn: () => getWhiteLabelTenants(),
  });

  // Mutación guardar tenant
  const saveMutation = useMutation({
    mutationFn: async (payload: {
      id?: string | undefined;
      slug: string;
      name: string;
      legalName?: string | undefined;
      isDefault?: boolean | undefined;
      isActive?: boolean | undefined;
      domain?: string | null | undefined;
      subdomain?: string | null | undefined;
      branding: TenantBranding;
      content: TenantContent;
      settings: TenantSettings;
    }) => {
      return await saveWhiteLabelTenant({ data: payload });
    },
    onSuccess: () => {
      toast.success("Marca guardada correctamente.");
      queryClient.invalidateQueries({ queryKey: ["white-label-tenants"] });
      setIsEditorOpen(false);
    },
    onError: (err: any) => {
      toast.error("Error al guardar la marca: " + (err.message || "Error desconocido"));
    },
  });

  // Mutación eliminar tenant
  const deleteMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      return await deleteWhiteLabelTenant({ data: { tenantId } });
    },
    onSuccess: () => {
      setTenantToDelete(null);
      toast.success("Marca eliminada correctamente.");
      queryClient.invalidateQueries({ queryKey: ["white-label-tenants"] });
    },
    onError: (err: any) => {
      toast.error("No se pudo eliminar la marca: " + (err.message || "Error desconocido"));
    },
  });

  const handleOpenCreate = () => {
    setEditingTenant(null);
    setFormSlug("");
    setFormName("");
    setFormLegalName("");
    setFormDomain("");
    setFormSubdomain("");
    setFormIsActive(true);
    setFormBranding({
      primaryColor: "#2563eb",
      primaryDarkColor: "#1d4ed8",
      accentColor: "#60a5fa",
      backgroundColor: "#0a0f1d",
      surfaceColor: "#111827",
      textColor: "#f9fafb",
      fontFamily: "Sora, sans-serif",
      borderRadius: "1.25rem",
      logoUrl: "",
      faviconUrl: "",
    });
    setFormContent({
      slogan: "Envíos directos y seguros",
      tagline: "Tu dinero en las mejores manos",
      supportEmail: "soporte@tuempresa.com",
      supportPhone: "+1 (800) 000-0000",
      supportWhatsapp: "18000000000",
      address: "",
    });
    setFormSettings({
      allowedOrigins: ["DO", "MX", "US", "CA", "BR", "CL", "ES", "FR"],
      allowedDestinations: ["HT"],
      feeMarkupPercent: 0,
      feeMarkupFixed: 0,
      enabledServices: {
        transfers: true,
        topups: true,
        crypto: true,
        virtualCards: true,
      },
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormSlug(tenant.slug);
    setFormName(tenant.name);
    setFormLegalName(tenant.legalName || "");
    setFormDomain(tenant.domain || "");
    setFormSubdomain(tenant.subdomain || "");
    setFormIsActive(tenant.isActive);
    setFormBranding({ ...tenant.branding });
    setFormContent({ ...tenant.content });
    setFormSettings({ ...tenant.settings });
    setIsEditorOpen(true);
  };

  const handleApplyPreset = (presetId: string) => {
    const found = THEME_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setFormBranding((prev) => ({
        ...prev,
        primaryColor: found.branding.primaryColor,
        primaryDarkColor: found.branding.primaryDarkColor,
        accentColor: found.branding.accentColor,
        backgroundColor: found.branding.backgroundColor,
        surfaceColor: found.branding.surfaceColor,
        borderRadius: found.branding.borderRadius,
      }));
      toast.info(`Preset "${found.name}" aplicado.`);
    }
  };

  const handleSubmitSave = () => {
    if (!formName.trim()) {
      toast.error("El nombre de la empresa es obligatorio.");
      return;
    }
    const cleanSlug = (formSlug || formName).toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-");
    if (!cleanSlug) {
      toast.error("El slug de la marca es obligatorio.");
      return;
    }

    const payload: {
      id?: string | undefined;
      slug: string;
      name: string;
      legalName?: string | undefined;
      isDefault?: boolean | undefined;
      isActive?: boolean | undefined;
      domain?: string | null | undefined;
      subdomain?: string | null | undefined;
      branding: TenantBranding;
      content: TenantContent;
      settings: TenantSettings;
    } = {
      slug: cleanSlug,
      name: formName.trim(),
      legalName: formLegalName.trim(),
      isDefault: editingTenant?.isDefault || false,
      isActive: formIsActive,
      domain: formDomain.trim() || null,
      subdomain: formSubdomain.trim() || null,
      branding: formBranding,
      content: formContent,
      settings: formSettings,
    };
    if (editingTenant?.id) {
      payload.id = editingTenant.id;
    }

    saveMutation.mutate(payload);
  };

  const copyBrandUrl = (slug: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://lajanrapid.app";
    const url = `${origin}/?brand=${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Enlace de la marca copiado al portapapeles.");
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <Building2 className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">White Label Multiempresa</h2>
                <p className="text-sm text-muted-foreground">
                  Gestiona marcas aliadas, dominios personalizados, colores y comisiones sobre el motor de Lajan Rapid.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentBrand.slug !== "default" && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetToDefault}
                className="gap-2 border-primary/40 text-primary"
              >
                <RefreshCw className="size-4" /> Restaurar Tema Lajan Rapid
              </Button>
            )}
            <Button onClick={handleOpenCreate} className="gap-2 bg-primary text-primary-foreground">
              <Plus className="size-4" /> Nueva Marca Aliada
            </Button>
          </div>
        </div>

        {/* Info Highlights */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/40 bg-surface/50 p-3">
            <p className="text-xs text-muted-foreground">Marca Raíz Insignia</p>
            <p className="mt-0.5 font-display text-base font-semibold text-primary">
              Lajan Rapid (Oficial)
            </p>
            <span className="text-[11px] text-muted-foreground">Siempre protegida e inmutable</span>
          </div>
          <div className="rounded-xl border border-border/40 bg-surface/50 p-3">
            <p className="text-xs text-muted-foreground">Marcas Aliadas Registradas</p>
            <p className="mt-0.5 font-display text-base font-semibold text-foreground">
              {tenants.length} {tenants.length === 1 ? "marca" : "marcas"}
            </p>
            <span className="text-[11px] text-muted-foreground">Multiempresa instantánea</span>
          </div>
          <div className="rounded-xl border border-border/40 bg-surface/50 p-3">
            <p className="text-xs text-muted-foreground">Personalización Dinámica</p>
            <p className="mt-0.5 font-display text-base font-semibold text-accent">
              CSS Variables + Dominio
            </p>
            <span className="text-[11px] text-muted-foreground">Logo, colores, comisiones y soporte</span>
          </div>
        </div>
      </div>

      {/* Lista de Empresas / Tenants */}
      <div className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-foreground">Empresas y Marcas Conectadas</h3>

        <div className="grid grid-cols-1 gap-4">
          {tenants.map((t) => {
            const isLajan = t.isDefault || t.slug === "default";
            const isCurrentlyActiveInSession = currentBrand.slug === t.slug;

            return (
              <div
                key={t.id}
                className="group relative flex flex-col justify-between gap-4 rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-border lg:flex-row lg:items-center"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar / Logo */}
                  <div
                    className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/50 bg-surface p-1"
                    style={{
                      boxShadow: `0 0 15px -3px ${t.branding.primaryColor}30`,
                    }}
                  >
                    {t.branding.logoUrl ? (
                      <img
                        src={t.branding.logoUrl}
                        alt={t.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span
                        className="font-display font-bold text-lg"
                        style={{ color: t.branding.primaryColor }}
                      >
                        {t.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Detalles */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display text-base font-bold text-foreground">{t.name}</h4>
                      {isLajan ? (
                        <Badge className="bg-primary/20 text-primary border-primary/30">
                          <ShieldCheck className="mr-1 size-3" /> Marca Principal (Root)
                        </Badge>
                      ) : (
                        <>
                          <Badge variant={t.isActive ? "default" : "secondary"}>
                            {t.isActive ? "Activa" : "Inactiva"}
                          </Badge>
                          {(t.slug === "vippip" || t.slug === "kash-ayiti") && (
                            <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">
                              Piloto Oficial
                            </Badge>
                          )}
                        </>
                      )}
                      {isCurrentlyActiveInSession && (
                        <Badge className="bg-accent/20 text-accent border-accent/30">
                          <Sparkles className="mr-1 size-3" /> Vista Previa Activa
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Slug: <strong className="text-foreground">{t.slug}</strong>
                      </span>
                      {t.domain && (
                        <span className="flex items-center gap-1">
                          <Globe className="size-3" /> {t.domain}
                        </span>
                      )}
                      {(t.settings.feeMarkupPercent ?? 0) > 0 && (
                        <span className="text-emerald-400">
                          +{t.settings.feeMarkupPercent}% markup
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-semibold text-primary">
                        <Users className="size-3" /> {getTenantAdmins(t).length} {getTenantAdmins(t).length === 1 ? "admin" : "admins"}
                      </span>
                    </div>

                    {/* Paleta de Colores */}
                    <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                      <span>Paleta:</span>
                      <span
                        className="size-3.5 rounded-full border border-white/20"
                        style={{ backgroundColor: t.branding.primaryColor }}
                        title={`Primario: ${t.branding.primaryColor}`}
                      />
                      <span
                        className="size-3.5 rounded-full border border-white/20"
                        style={{ backgroundColor: t.branding.accentColor }}
                        title={`Acento: ${t.branding.accentColor}`}
                      />
                      <span
                        className="size-3.5 rounded-full border border-white/20"
                        style={{ backgroundColor: t.branding.backgroundColor || "#0b1426" }}
                        title={`Fondo: ${t.branding.backgroundColor || "#0b1426"}`}
                      />
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {t.branding.primaryColor}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      switchBrand(t.slug);
                      toast.success(`Tema de "${t.name}" aplicado a la sesión.`);
                    }}
                    className="gap-1.5 text-xs"
                    title="Ver en vivo cómo se ve la interfaz con los colores y logos de esta marca"
                  >
                    <Eye className="size-3.5" /> Probar Tema
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyBrandUrl(t.slug)}
                    className="gap-1.5 text-xs"
                    title="Copiar link de acceso directo (?brand=...)"
                  >
                    <Copy className="size-3.5" /> Copiar Enlace
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedUserToAssign("");
                      setManagingAdminsTenant(t);
                    }}
                    className="gap-1.5 text-xs text-primary border-primary/40 hover:bg-primary/10"
                    title={`Ver y gestionar administradores para ${t.name}`}
                  >
                    <Users className="size-3.5" /> Admins ({getTenantAdmins(t).length})
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(t)}
                    className="gap-1.5 text-xs"
                  >
                    <Edit className="size-3.5" /> Editar
                  </Button>

                  {!isLajan && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTenantToDelete(t)}
                      className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Eliminar esta marca"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Editor / Creador de Marca */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Palette className="size-5 text-primary" />
              {editingTenant ? `Editar Marca: ${editingTenant.name}` : "Crear Nueva Marca Aliada"}
            </DialogTitle>
            <DialogDescription>
              Personaliza automáticamente la identidad visual, colores, dominios y reglas de negocio.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="theming" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="theming" className="gap-1.5 text-xs">
                <Palette className="size-3.5" /> Diseño & Colores
              </TabsTrigger>
              <TabsTrigger value="identity" className="gap-1.5 text-xs">
                <Building2 className="size-3.5" /> Identidad
              </TabsTrigger>
              <TabsTrigger value="content" className="gap-1.5 text-xs">
                <Phone className="size-3.5" /> Contenido
              </TabsTrigger>
              <TabsTrigger value="business" className="gap-1.5 text-xs">
                <DollarSign className="size-3.5" /> Negocio
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Diseño & Colores (Auto Theming) */}
            <TabsContent value="theming" className="space-y-4">
              <div className="rounded-xl border border-border/50 bg-surface/30 p-3 space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Presets de Colores Instantáneos
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset.id)}
                      className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card p-2 text-left transition hover:border-primary"
                    >
                      <div className="flex -space-x-1.5">
                        <span
                          className="size-4 rounded-full border border-black/40"
                          style={{ backgroundColor: preset.branding.primaryColor }}
                        />
                        <span
                          className="size-4 rounded-full border border-black/40"
                          style={{ backgroundColor: preset.branding.accentColor }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{preset.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Colores Detallados */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Color Primario (Botones y Marca)</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="primaryColorPicker"
                      value={formBranding.primaryColor}
                      onChange={(e) =>
                        setFormBranding((b) => ({ ...b, primaryColor: e.target.value }))
                      }
                      className="size-10 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                    />
                    <Input
                      id="primaryColor"
                      value={formBranding.primaryColor}
                      onChange={(e) =>
                        setFormBranding((b) => ({ ...b, primaryColor: e.target.value }))
                      }
                      placeholder="#10b981"
                      className="font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accentColor">Color Acento (Resaltados y Gradientes)</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="accentColorPicker"
                      value={formBranding.accentColor}
                      onChange={(e) =>
                        setFormBranding((b) => ({ ...b, accentColor: e.target.value }))
                      }
                      className="size-10 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                    />
                    <Input
                      id="accentColor"
                      value={formBranding.accentColor}
                      onChange={(e) =>
                        setFormBranding((b) => ({ ...b, accentColor: e.target.value }))
                      }
                      placeholder="#34d399"
                      className="font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backgroundColor">Color de Fondo General</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="bgColorPicker"
                      value={formBranding.backgroundColor || "#0b1426"}
                      onChange={(e) =>
                        setFormBranding((b) => ({ ...b, backgroundColor: e.target.value }))
                      }
                      className="size-10 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                    />
                    <Input
                      id="backgroundColor"
                      value={formBranding.backgroundColor || "#0b1426"}
                      onChange={(e) =>
                        setFormBranding((b) => ({ ...b, backgroundColor: e.target.value }))
                      }
                      placeholder="#0b1426"
                      className="font-mono text-xs uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Logotipos y Assets */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">URL del Logotipo (PNG / SVG transparente)</Label>
                  <Input
                    id="logoUrl"
                    value={formBranding.logoUrl || ""}
                    onChange={(e) =>
                      setFormBranding((b) => ({ ...b, logoUrl: e.target.value }))
                    }
                    placeholder="https://tu-dominio.com/logo.png"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Si se deja vacío, se mostrará el ícono generado con el nombre.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="faviconUrl">URL del Favicon (.ico / .png)</Label>
                  <Input
                    id="faviconUrl"
                    value={formBranding.faviconUrl || ""}
                    onChange={(e) =>
                      setFormBranding((b) => ({ ...b, faviconUrl: e.target.value }))
                    }
                    placeholder="https://tu-dominio.com/favicon.png"
                  />
                </div>
              </div>

              {/* Vista Previa Interactiva */}
              <div className="mt-4 rounded-xl border border-border/70 p-4 space-y-3" style={{ backgroundColor: formBranding.backgroundColor || "#0b1426" }}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Simulador de Tarjeta y Botón en Tiempo Real
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-white/10 p-4" style={{ backgroundColor: formBranding.surfaceColor || "#121d33" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="grid size-10 place-items-center rounded-lg overflow-hidden p-1"
                      style={{ backgroundColor: "#ffffff" }}
                    >
                      {formBranding.logoUrl ? (
                        <img src={formBranding.logoUrl} alt="Preview" className="h-full w-full object-contain" />
                      ) : (
                        <span className="font-bold text-sm" style={{ color: formBranding.primaryColor }}>
                          {formName.slice(0, 2).toUpperCase() || "WL"}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-white text-base">
                        {formName || "Nombre de tu Empresa"}
                      </h4>
                      <p className="text-xs text-white/70">
                        {formContent.slogan || "Envía dinero en minutos"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                    style={{
                      backgroundColor: formBranding.primaryColor,
                      color: "#000000",
                    }}
                  >
                    Enviar Dinero
                  </button>
                </div>

                <div className="pt-2 text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                    <span>Firma obligatoria: Creado por</span>
                    <strong className="text-white underline underline-offset-2">lajanrapid.app</strong>
                  </span>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Identidad & Dominios */}
            <TabsContent value="identity" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="formName">Nombre Comercial de la Marca *</Label>
                  <Input
                    id="formName"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej. VipPip Express"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="formSlug">Slug de Identificación *</Label>
                  <Input
                    id="formSlug"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="vippip"
                    className="font-mono text-xs"
                    disabled={editingTenant?.isDefault}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Enlace de acceso: <code>lajanrapid.app/?brand={formSlug || "..."}</code>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="formLegalName">Razón Social o Nombre Legal</Label>
                  <Input
                    id="formLegalName"
                    value={formLegalName}
                    onChange={(e) => setFormLegalName(e.target.value)}
                    placeholder="Ej. VipPip Payments S.A."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="formDomain">Dominio Personalizado (opcional)</Label>
                  <Input
                    id="formDomain"
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value)}
                    placeholder="remesasvippip.com"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/50 p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="formIsActive">Estado de la Marca</Label>
                  <p className="text-xs text-muted-foreground">
                    Si se desactiva, los usuarios que entren por su enlace verán Lajan Rapid por defecto.
                  </p>
                </div>
                <Switch
                  id="formIsActive"
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                  disabled={editingTenant?.isDefault}
                />
              </div>
            </TabsContent>

            {/* TAB 3: Contenido & Soporte */}
            <TabsContent value="content" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="slogan">Slogan Comercial</Label>
                  <Input
                    id="slogan"
                    value={formContent.slogan || ""}
                    onChange={(e) =>
                      setFormContent((c) => ({ ...c, slogan: e.target.value }))
                    }
                    placeholder="Envía dinero y recarga a Haití en minutos"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">Subtítulo / Promesa</Label>
                  <Input
                    id="tagline"
                    value={formContent.tagline || ""}
                    onChange={(e) =>
                      setFormContent((c) => ({ ...c, tagline: e.target.value }))
                    }
                    placeholder="El servicio más rápido de remesas directas"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="supportEmail">Correo de Soporte</Label>
                  <Input
                    id="supportEmail"
                    value={formContent.supportEmail || ""}
                    onChange={(e) =>
                      setFormContent((c) => ({ ...c, supportEmail: e.target.value }))
                    }
                    placeholder="ayuda@tuempresa.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supportPhone">Teléfono de Atención</Label>
                  <Input
                    id="supportPhone"
                    value={formContent.supportPhone || ""}
                    onChange={(e) =>
                      setFormContent((c) => ({ ...c, supportPhone: e.target.value }))
                    }
                    placeholder="+1 (800) 123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supportWhatsapp">Número de WhatsApp</Label>
                  <Input
                    id="supportWhatsapp"
                    value={formContent.supportWhatsapp || ""}
                    onChange={(e) =>
                      setFormContent((c) => ({ ...c, supportWhatsapp: e.target.value }))
                    }
                    placeholder="18001234567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección de Oficina / Legal</Label>
                <Input
                  id="address"
                  value={formContent.address || ""}
                  onChange={(e) =>
                    setFormContent((c) => ({ ...c, address: e.target.value }))
                  }
                  placeholder="Ciudad, País"
                />
              </div>
            </TabsContent>

            {/* TAB 4: Negocio & Comisiones */}
            <TabsContent value="business" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="feeMarkupPercent">Margen Adicional sobre Remesas (%)</Label>
                  <Input
                    id="feeMarkupPercent"
                    type="number"
                    step="0.05"
                    value={formSettings.feeMarkupPercent || 0}
                    onChange={(e) =>
                      setFormSettings((s) => ({
                        ...s,
                        feeMarkupPercent: parseFloat(e.target.value) || 0,
                      }))
                    }
                    placeholder="0.50"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ej. 0.50 agrega +0.50% a la comisión base de Lajan Rapid como ganancia del aliado.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feeMarkupFixed">Comisión Fija Adicional ($)</Label>
                  <Input
                    id="feeMarkupFixed"
                    type="number"
                    step="0.50"
                    value={formSettings.feeMarkupFixed || 0}
                    onChange={(e) =>
                      setFormSettings((s) => ({
                        ...s,
                        feeMarkupFixed: parseFloat(e.target.value) || 0,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border/50 p-4">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Servicios Disponibles para esta Marca
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Envíos de Remesas</span>
                    <Switch
                      checked={formSettings.enabledServices.transfers}
                      onCheckedChange={(checked) =>
                        setFormSettings((s) => ({
                          ...s,
                          enabledServices: { ...s.enabledServices, transfers: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Recargas Telefónicas</span>
                    <Switch
                      checked={formSettings.enabledServices.topups}
                      onCheckedChange={(checked) =>
                        setFormSettings((s) => ({
                          ...s,
                          enabledServices: { ...s.enabledServices, topups: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Depósitos Cripto</span>
                    <Switch
                      checked={formSettings.enabledServices.crypto}
                      onCheckedChange={(checked) =>
                        setFormSettings((s) => ({
                          ...s,
                          enabledServices: { ...s.enabledServices, crypto: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tarjetas Virtuales</span>
                    <Switch
                      checked={formSettings.enabledServices.virtualCards}
                      onCheckedChange={(checked) =>
                        setFormSettings((s) => ({
                          ...s,
                          enabledServices: { ...s.enabledServices, virtualCards: checked },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setIsEditorOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitSave}
              disabled={saveMutation.isPending}
              className="gap-2 bg-primary text-primary-foreground"
            >
              {saveMutation.isPending ? "Guardando..." : "Guardar Marca"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmación para Eliminar Marca */}
      <Dialog open={!!tenantToDelete} onOpenChange={(open) => !open && setTenantToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-display text-lg">
              <Trash2 className="size-5" /> Eliminar Marca Aliada
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm">
              ¿Estás seguro de que deseas eliminar permanentemente la marca aliada{" "}
              <strong className="text-foreground">{tenantToDelete?.name}</strong> (
              <code>{tenantToDelete?.slug}</code>)?
              <br />
              <span className="mt-2 block text-xs text-muted-foreground">
                Esta acción removerá su acceso, personalización y configuración por completo.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setTenantToDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (tenantToDelete) {
                  deleteMutation.mutate(tenantToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="gap-2"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar Definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Gestión de Administradores por Marca White Label */}
      <Dialog open={!!managingAdminsTenant} onOpenChange={(open) => !open && setManagingAdminsTenant(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-lg">
              <Users className="size-5 text-primary" />
              Administradores de {managingAdminsTenant?.name}
            </DialogTitle>
            <DialogDescription>
              Asigna qué usuarios pueden administrar esta marca y define sus permisos específicos de acceso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Lista de Administradores Actuales de esta Marca */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Administradores Asignados ({managingAdminsTenant ? getTenantAdmins(managingAdminsTenant).length : 0})
              </Label>

              {managingAdminsTenant && getTenantAdmins(managingAdminsTenant).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 p-5 text-center bg-surface/30">
                  <p className="text-sm font-medium text-muted-foreground">
                    Esta marca aún no tiene administradores dedicados.
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-1">
                    Los Super Administradores globales gestionan esta empresa por defecto. Puedes asignar uno abajo.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {managingAdminsTenant &&
                    getTenantAdmins(managingAdminsTenant).map((adminUser) => {
                      const perms = adminsMap[adminUser.id];
                      return (
                        <div
                          key={adminUser.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3"
                        >
                          <div>
                            <p className="font-semibold text-sm text-foreground">
                              {adminUser.full_name || "Sin nombre"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {adminUser.phone || "Sin teléfono"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">
                              <ShieldCheck className="size-3 mr-1" />
                              {perms?.isSuperAdmin
                                ? "Acceso Total a la Marca"
                                : `${perms?.allowedTabs?.length ?? 0} módulos permitidos`}
                            </Badge>

                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1"
                              onClick={() => {
                                setAdminUserToEdit(adminUser);
                              }}
                            >
                              <Edit className="size-3" /> Permisos
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Asignar Nuevo Administrador a esta Empresa */}
            <div className="rounded-xl border border-border/60 bg-surface/40 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="size-4 text-primary" />
                <Label className="font-bold text-sm">Asignar Nuevo Administrador a {managingAdminsTenant?.name}</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Selecciona un usuario registrado para convertirlo en administrador de esta marca aliada con permisos específicos.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="w-full">
                  <select
                    value={selectedUserToAssign}
                    onChange={(e) => setSelectedUserToAssign(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">Seleccionar usuario de la plataforma...</option>
                    {allProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || "Sin nombre"} ({p.phone || p.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  disabled={!selectedUserToAssign}
                  onClick={() => {
                    const foundUser = allProfiles.find((p) => p.id === selectedUserToAssign);
                    if (foundUser) {
                      setAdminUserToEdit(foundUser);
                    }
                  }}
                  className="w-full sm:w-auto shrink-0 gap-1.5 bg-primary text-primary-foreground text-xs font-semibold"
                >
                  <ShieldCheck className="size-3.5" /> Configurar Permisos
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setManagingAdminsTenant(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de edición de roles y permisos activado desde WhiteLabelPanel */}
      {adminUserToEdit && (
        <AdminPermissionsModal
          isOpen={Boolean(adminUserToEdit)}
          onClose={() => setAdminUserToEdit(null)}
          user={adminUserToEdit}
          currentRole="admin"
          currentPerms={
            adminsMap[adminUserToEdit.id] || {
              isSuperAdmin: false,
              allowedTabs: ["tx", "recargas", "kyc", "soporte"],
              tenantId: managingAdminsTenant?.id,
              tenantSlug: managingAdminsTenant?.slug,
              tenantName: managingAdminsTenant?.name,
            }
          }
        />
      )}
    </div>
  );
}
