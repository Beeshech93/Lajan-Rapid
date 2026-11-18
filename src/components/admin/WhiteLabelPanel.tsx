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
  Key,
  Lock,
  CheckCircle2,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Loader2,
  X,
} from "lucide-react";

import {
  type Tenant,
  type TenantBranding,
  type TenantContent,
  type TenantSettings,
  type TenantApis,
  THEME_PRESETS,
  DEFAULT_LAJAN_RAPID_TENANT,
} from "@/lib/whitelabel.types";
import {
  getWhiteLabelTenants,
  saveWhiteLabelTenant,
  deleteWhiteLabelTenant,
  uploadWhiteLabelAsset,
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

  // Pestaña activa del editor
  const [activeEditTab, setActiveEditTab] = useState<string>("theming");

  // APIs propias de la empresa
  const [formApis, setFormApis] = useState<TenantApis>({
    mercadoPago: { enabled: false, publicKey: "", accessToken: "", webhookSecret: "" },
    stripe: { enabled: false, publishableKey: "", secretKey: "", webhookSecret: "" },
    bazik: { enabled: false, apiKey: "", apiSecret: "", endpoint: "" },
    dingConnect: { enabled: false, apiKey: "" },
    resend: { enabled: false, apiKey: "", fromEmail: "" },
    webhooks: { enabled: false, url: "", secretKey: "" },
  });

  // Estados de subida de imágenes (Logo, Favicon, App Icon)
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [manualUrlInputs, setManualUrlInputs] = useState<{
    logoUrl?: boolean;
    faviconUrl?: boolean;
    appIconUrl?: boolean;
    logoDarkUrl?: boolean;
  }>({});
  const uploadAssetFn = useServerFn(uploadWhiteLabelAsset);

  const handleImageUpload = async (
    file: File,
    field: "logoUrl" | "faviconUrl" | "logoDarkUrl" | "appIconUrl",
    assetType: "logo" | "favicon" | "logoDark" | "appIcon"
  ) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede pesar más de 5 MB.");
      return;
    }

    setUploadingField(field);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await uploadAssetFn({
        data: {
          fileName: file.name,
          fileBase64: base64,
          contentType: file.type || "image/png",
          assetType,
        },
      });

      if (res?.publicUrl) {
        setFormBranding((b) => ({ ...b, [field]: res.publicUrl }));
        toast.success(
          field === "logoUrl"
            ? "Logotipo subido y aplicado exitosamente."
            : field === "faviconUrl"
            ? "Favicon subido y aplicado exitosamente."
            : "Imagen subida exitosamente."
        );
      }
    } catch (err: any) {
      console.error("Error al subir archivo:", err);
      toast.error("Error al subir imagen: " + (err.message || "Error desconocido"));
    } finally {
      setUploadingField(null);
    }
  };

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
      apis?: TenantApis | undefined;
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
    setFormApis({
      mercadoPago: { enabled: false, publicKey: "", accessToken: "", webhookSecret: "" },
      stripe: { enabled: false, publishableKey: "", secretKey: "", webhookSecret: "" },
      bazik: { enabled: false, apiKey: "", apiSecret: "", endpoint: "" },
      dingConnect: { enabled: false, apiKey: "" },
      resend: { enabled: false, apiKey: "", fromEmail: "" },
      webhooks: { enabled: false, url: "", secretKey: "" },
    });
    setActiveEditTab("theming");
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (tenant: Tenant, tab: string = "theming") => {
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
    setFormApis({
      mercadoPago: {
        enabled: tenant.apis?.mercadoPago?.enabled ?? false,
        publicKey: tenant.apis?.mercadoPago?.publicKey || "",
        accessToken: tenant.apis?.mercadoPago?.accessToken || "",
        webhookSecret: tenant.apis?.mercadoPago?.webhookSecret || "",
      },
      stripe: {
        enabled: tenant.apis?.stripe?.enabled ?? false,
        publishableKey: tenant.apis?.stripe?.publishableKey || "",
        secretKey: tenant.apis?.stripe?.secretKey || "",
        webhookSecret: tenant.apis?.stripe?.webhookSecret || "",
      },
      bazik: {
        enabled: tenant.apis?.bazik?.enabled ?? false,
        apiKey: tenant.apis?.bazik?.apiKey || "",
        apiSecret: tenant.apis?.bazik?.apiSecret || "",
        endpoint: tenant.apis?.bazik?.endpoint || "",
      },
      dingConnect: {
        enabled: tenant.apis?.dingConnect?.enabled ?? false,
        apiKey: tenant.apis?.dingConnect?.apiKey || "",
      },
      resend: {
        enabled: tenant.apis?.resend?.enabled ?? false,
        apiKey: tenant.apis?.resend?.apiKey || "",
        fromEmail: tenant.apis?.resend?.fromEmail || "",
      },
      webhooks: {
        enabled: tenant.apis?.webhooks?.enabled ?? false,
        url: tenant.apis?.webhooks?.url || "",
        secretKey: tenant.apis?.webhooks?.secretKey || "",
      },
    });
    setActiveEditTab(tab);
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
      apis?: TenantApis | undefined;
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
      apis: formApis,
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
                      {t.apis && Object.values(t.apis).some((api: any) => api?.enabled) && (
                        <span className="flex items-center gap-1 font-semibold text-amber-400">
                          <Key className="size-3" /> APIs Propias
                        </span>
                      )}
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
                    onClick={() => handleOpenEdit(t, "apis")}
                    className="gap-1.5 text-xs text-amber-400 border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300"
                    title={`Configurar APIs y pasarelas de ${t.name}`}
                  >
                    <Key className="size-3.5" /> APIs
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(t, "theming")}
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

          <Tabs value={activeEditTab} onValueChange={setActiveEditTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="theming" className="gap-1.5 text-xs">
                <Palette className="size-3.5" /> Diseño
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
              <TabsTrigger value="apis" className="gap-1.5 text-xs text-amber-400 data-[state=active]:text-amber-300">
                <Key className="size-3.5" /> APIs
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

              {/* Sección de Recursos Gráficos / Subida de Imágenes */}
              <div className="space-y-4 pt-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <ImageIcon className="size-4 text-primary" /> Imágenes, Logotipo y Favicon
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Sube directamente tus archivos de imagen en formato PNG, SVG, JPG, WebP o ICO. Se almacenarán automáticamente en la nube de tu marca.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* 1. Logotipo Principal */}
                  <div className="rounded-xl border border-border/70 bg-surface/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          Logotipo Principal (PNG / SVG)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Aparece en la barra de navegación y comprobantes
                        </p>
                      </div>
                      {formBranding.logoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormBranding((b) => ({ ...b, logoUrl: "" }))}
                          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                          title="Quitar logotipo"
                        >
                          <Trash2 className="size-3.5 mr-1" /> Quitar
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border/80 bg-background/50 p-4 transition-colors hover:border-primary/50">
                      {formBranding.logoUrl ? (
                        <div className="relative flex flex-col items-center gap-2">
                          <div
                            className="flex h-20 w-44 items-center justify-center rounded-lg border border-border/60 p-2 overflow-hidden"
                            style={{
                              backgroundColor: formBranding.backgroundColor || "#0b1426",
                            }}
                          >
                            <img
                              src={formBranding.logoUrl}
                              alt="Logo preview"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {formBranding.logoUrl.split("/").pop()}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center p-2">
                          <div className="rounded-full bg-primary/10 p-2.5 text-primary mb-2">
                            <Upload className="size-5" />
                          </div>
                          <p className="text-xs font-medium">Sube el Logotipo de tu marca</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            PNG transparente, SVG, WebP o JPG (Recomendado 512x512)
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            className="hidden"
                            disabled={uploadingField === "logoUrl"}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(file, "logoUrl", "logo");
                            }}
                          />
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                            {uploadingField === "logoUrl" ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" /> Subiendo...
                              </>
                            ) : (
                              <>
                                <Upload className="size-3.5" />
                                {formBranding.logoUrl ? "Cambiar Imagen" : "Subir Logotipo"}
                              </>
                            )}
                          </span>
                        </label>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setManualUrlInputs((prev) => ({ ...prev, logoUrl: !prev.logoUrl }))
                          }
                          className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {manualUrlInputs.logoUrl ? "Ocultar URL" : "Pegar URL"}
                        </Button>
                      </div>

                      {manualUrlInputs.logoUrl && (
                        <div className="w-full pt-2">
                          <Input
                            value={formBranding.logoUrl || ""}
                            onChange={(e) =>
                              setFormBranding((b) => ({ ...b, logoUrl: e.target.value }))
                            }
                            placeholder="https://ejemplo.com/logo.png"
                            className="text-xs font-mono h-8"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Favicon del Navegador */}
                  <div className="rounded-xl border border-border/70 bg-surface/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          Favicon (.ico / .png / .svg)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Ícono visible en la pestaña del navegador web
                        </p>
                      </div>
                      {formBranding.faviconUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormBranding((b) => ({ ...b, faviconUrl: "" }))}
                          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                          title="Quitar favicon"
                        >
                          <Trash2 className="size-3.5 mr-1" /> Quitar
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border/80 bg-background/50 p-4 transition-colors hover:border-primary/50">
                      {formBranding.faviconUrl ? (
                        <div className="flex flex-col items-center gap-2">
                          {/* Simulación pestaña de navegador */}
                          <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-border/60 bg-surface px-3 py-1.5 text-xs text-foreground shadow-sm">
                            <img
                              src={formBranding.faviconUrl}
                              alt="Favicon preview"
                              className="size-4 object-contain rounded-sm"
                            />
                            <span className="font-medium text-[11px] max-w-[120px] truncate">
                              {formName || "Mi Empresa"}
                            </span>
                            <X className="size-3 text-muted-foreground ml-1 opacity-60" />
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {formBranding.faviconUrl.split("/").pop()}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center p-2">
                          <div className="rounded-full bg-primary/10 p-2.5 text-primary mb-2">
                            <Upload className="size-5" />
                          </div>
                          <p className="text-xs font-medium">Sube el Favicon de la pestaña</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Formatos .ico, .png o .svg (Recomendado 32x32 o 64x64)
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/x-icon,image/png,image/svg+xml,image/vnd.microsoft.icon,image/webp"
                            className="hidden"
                            disabled={uploadingField === "faviconUrl"}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(file, "faviconUrl", "favicon");
                            }}
                          />
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                            {uploadingField === "faviconUrl" ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" /> Subiendo...
                              </>
                            ) : (
                              <>
                                <Upload className="size-3.5" />
                                {formBranding.faviconUrl ? "Cambiar Favicon" : "Subir Favicon"}
                              </>
                            )}
                          </span>
                        </label>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setManualUrlInputs((prev) => ({ ...prev, faviconUrl: !prev.faviconUrl }))
                          }
                          className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {manualUrlInputs.faviconUrl ? "Ocultar URL" : "Pegar URL"}
                        </Button>
                      </div>

                      {manualUrlInputs.faviconUrl && (
                        <div className="w-full pt-2">
                          <Input
                            value={formBranding.faviconUrl || ""}
                            onChange={(e) =>
                              setFormBranding((b) => ({ ...b, faviconUrl: e.target.value }))
                            }
                            placeholder="https://ejemplo.com/favicon.ico"
                            className="text-xs font-mono h-8"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Ícono de la App Móvil / PWA */}
                  <div className="rounded-xl border border-border/70 bg-surface/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          Ícono de App Móvil / PWA (512x512)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Ícono para cuando los clientes instalan la App en su celular
                        </p>
                      </div>
                      {formBranding.appIconUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormBranding((b) => ({ ...b, appIconUrl: "" }))}
                          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                          title="Quitar ícono PWA"
                        >
                          <Trash2 className="size-3.5 mr-1" /> Quitar
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border/80 bg-background/50 p-4 transition-colors hover:border-primary/50">
                      {formBranding.appIconUrl ? (
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className="size-16 rounded-2xl p-2.5 flex items-center justify-center shadow-lg border border-border/60 overflow-hidden"
                            style={{ backgroundColor: formBranding.surfaceColor || "#000000" }}
                          >
                            <img
                              src={formBranding.appIconUrl}
                              alt="App Icon preview"
                              className="h-full w-full object-contain"
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {formBranding.appIconUrl.split("/").pop()}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center p-2">
                          <div className="rounded-full bg-primary/10 p-2.5 text-primary mb-2">
                            <Smartphone className="size-5" />
                          </div>
                          <p className="text-xs font-medium">Sube el Ícono de la App Móvil</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            PNG cuadrado 512x512px recomendado
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/png,image/webp,image/jpeg"
                            className="hidden"
                            disabled={uploadingField === "appIconUrl"}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(file, "appIconUrl", "appIcon");
                            }}
                          />
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                            {uploadingField === "appIconUrl" ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" /> Subiendo...
                              </>
                            ) : (
                              <>
                                <Upload className="size-3.5" />
                                {formBranding.appIconUrl ? "Cambiar Ícono" : "Subir Ícono Móvil"}
                              </>
                            )}
                          </span>
                        </label>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setManualUrlInputs((prev) => ({ ...prev, appIconUrl: !prev.appIconUrl }))
                          }
                          className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {manualUrlInputs.appIconUrl ? "Ocultar URL" : "Pegar URL"}
                        </Button>
                      </div>

                      {manualUrlInputs.appIconUrl && (
                        <div className="w-full pt-2">
                          <Input
                            value={formBranding.appIconUrl || ""}
                            onChange={(e) =>
                              setFormBranding((b) => ({ ...b, appIconUrl: e.target.value }))
                            }
                            placeholder="https://ejemplo.com/icon-512.png"
                            className="text-xs font-mono h-8"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Logotipo Modo Oscuro (Opcional) */}
                  <div className="rounded-xl border border-border/70 bg-surface/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          Logotipo Modo Oscuro (Opcional)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Variante con tipografía clara para fondos oscuros
                        </p>
                      </div>
                      {formBranding.logoDarkUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormBranding((b) => ({ ...b, logoDarkUrl: "" }))}
                          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                          title="Quitar logotipo oscuro"
                        >
                          <Trash2 className="size-3.5 mr-1" /> Quitar
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border/80 bg-background/50 p-4 transition-colors hover:border-primary/50">
                      {formBranding.logoDarkUrl ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex h-20 w-44 items-center justify-center rounded-lg border border-white/20 bg-slate-950 p-2 overflow-hidden">
                            <img
                              src={formBranding.logoDarkUrl}
                              alt="Dark logo preview"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {formBranding.logoDarkUrl.split("/").pop()}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center p-2">
                          <div className="rounded-full bg-primary/10 p-2.5 text-primary mb-2">
                            <ImageIcon className="size-5" />
                          </div>
                          <p className="text-xs font-medium">Logotipo para fondo oscuro</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Si se omite, se usa el logotipo principal
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            className="hidden"
                            disabled={uploadingField === "logoDarkUrl"}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(file, "logoDarkUrl", "logoDark");
                            }}
                          />
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                            {uploadingField === "logoDarkUrl" ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" /> Subiendo...
                              </>
                            ) : (
                              <>
                                <Upload className="size-3.5" />
                                {formBranding.logoDarkUrl ? "Cambiar Imagen" : "Subir Logo Oscuro"}
                              </>
                            )}
                          </span>
                        </label>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setManualUrlInputs((prev) => ({ ...prev, logoDarkUrl: !prev.logoDarkUrl }))
                          }
                          className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {manualUrlInputs.logoDarkUrl ? "Ocultar URL" : "Pegar URL"}
                        </Button>
                      </div>

                      {manualUrlInputs.logoDarkUrl && (
                        <div className="w-full pt-2">
                          <Input
                            value={formBranding.logoDarkUrl || ""}
                            onChange={(e) =>
                              setFormBranding((b) => ({ ...b, logoDarkUrl: e.target.value }))
                            }
                            placeholder="https://ejemplo.com/logo-dark.png"
                            className="text-xs font-mono h-8"
                          />
                        </div>
                      )}
                    </div>
                  </div>
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

            {/* TAB 5: APIs & Pasarelas Propias */}
            <TabsContent value="apis" className="space-y-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <Key className="size-4" /> Pasarelas & APIs Propias de la Marca
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cada empresa aliada puede conectar sus propias credenciales para cobrar y dispersar directamente a sus cuentas bancarias. Si un servicio se mantiene deshabilitado, el sistema utilizará automáticamente las pasarelas compartidas de Lajan Rapid como respaldo.
                </p>
              </div>

              {/* Mercado Pago (México) */}
              <div className="rounded-xl border border-border/60 bg-surface/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-sky-500/15 text-sky-400 font-bold text-xs">
                      MP
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold">Mercado Pago (México)</h4>
                      <p className="text-xs text-muted-foreground">Cobro con tarjetas, SPEI y tiendas OXXO en México</p>
                    </div>
                  </div>
                  <Switch
                    checked={formApis.mercadoPago?.enabled ?? false}
                    onCheckedChange={(checked) =>
                      setFormApis((prev) => ({
                        ...prev,
                        mercadoPago: { ...(prev.mercadoPago || {}), enabled: checked },
                      }))
                    }
                  />
                </div>

                {formApis.mercadoPago?.enabled && (
                  <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2 border-t border-border/40">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-medium">Public Key (Clave Pública)</Label>
                      <Input
                        placeholder="APP_USR-xxxx-xxxx..."
                        value={formApis.mercadoPago?.publicKey || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            mercadoPago: { ...(prev.mercadoPago || {}), publicKey: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Access Token (Producción)</Label>
                      <Input
                        type="password"
                        placeholder="APP_USR-xxxx..."
                        value={formApis.mercadoPago?.accessToken || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            mercadoPago: { ...(prev.mercadoPago || {}), accessToken: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Webhook Secret</Label>
                      <Input
                        type="password"
                        placeholder="Firma secreta del webhook"
                        value={formApis.mercadoPago?.webhookSecret || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            mercadoPago: { ...(prev.mercadoPago || {}), webhookSecret: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Stripe (Internacional) */}
              <div className="rounded-xl border border-border/60 bg-surface/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400 font-bold text-xs">
                      ST
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold">Stripe (Cobros Globales)</h4>
                      <p className="text-xs text-muted-foreground">Tarjetas de crédito/débito internacionales y Apple/Google Pay</p>
                    </div>
                  </div>
                  <Switch
                    checked={formApis.stripe?.enabled ?? false}
                    onCheckedChange={(checked) =>
                      setFormApis((prev) => ({
                        ...prev,
                        stripe: { ...(prev.stripe || {}), enabled: checked },
                      }))
                    }
                  />
                </div>

                {formApis.stripe?.enabled && (
                  <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2 border-t border-border/40">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-medium">Publishable Key</Label>
                      <Input
                        placeholder="pk_live_... o pk_test_..."
                        value={formApis.stripe?.publishableKey || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            stripe: { ...(prev.stripe || {}), publishableKey: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Secret Key</Label>
                      <Input
                        type="password"
                        placeholder="sk_live_..."
                        value={formApis.stripe?.secretKey || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            stripe: { ...(prev.stripe || {}), secretKey: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Webhook Signing Secret</Label>
                      <Input
                        type="password"
                        placeholder="whsec_..."
                        value={formApis.stripe?.webhookSecret || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            stripe: { ...(prev.stripe || {}), webhookSecret: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bazik API (Haití) */}
              <div className="rounded-xl border border-border/60 bg-surface/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400 font-bold text-xs">
                      BZ
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold">Bazik API (Dispersión MonCash & NatCash)</h4>
                      <p className="text-xs text-muted-foreground">Pago automático directo a billeteras móviles en Haití</p>
                    </div>
                  </div>
                  <Switch
                    checked={formApis.bazik?.enabled ?? false}
                    onCheckedChange={(checked) =>
                      setFormApis((prev) => ({
                        ...prev,
                        bazik: { ...(prev.bazik || {}), enabled: checked },
                      }))
                    }
                  />
                </div>

                {formApis.bazik?.enabled && (
                  <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2 border-t border-border/40">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-medium">API Endpoint (Opcional)</Label>
                      <Input
                        placeholder="https://api.bazik.io/v1"
                        value={formApis.bazik?.endpoint || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            bazik: { ...(prev.bazik || {}), endpoint: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">API Key</Label>
                      <Input
                        placeholder="bzk_live_..."
                        value={formApis.bazik?.apiKey || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            bazik: { ...(prev.bazik || {}), apiKey: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">API Secret</Label>
                      <Input
                        type="password"
                        placeholder="Clave secreta Bazik"
                        value={formApis.bazik?.apiSecret || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            bazik: { ...(prev.bazik || {}), apiSecret: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* DingConnect (Recargas Móviles) */}
              <div className="rounded-xl border border-border/60 bg-surface/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-orange-500/15 text-orange-400 font-bold text-xs">
                      DC
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold">DingConnect (Recargas Móviles)</h4>
                      <p className="text-xs text-muted-foreground">Recargas telefónicas instantáneas para Digicel y Natcom</p>
                    </div>
                  </div>
                  <Switch
                    checked={formApis.dingConnect?.enabled ?? false}
                    onCheckedChange={(checked) =>
                      setFormApis((prev) => ({
                        ...prev,
                        dingConnect: { ...(prev.dingConnect || {}), enabled: checked },
                      }))
                    }
                  />
                </div>

                {formApis.dingConnect?.enabled && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">DingConnect API Key</Label>
                      <Input
                        type="password"
                        placeholder="Clave de API DingConnect"
                        value={formApis.dingConnect?.apiKey || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            dingConnect: { ...(prev.dingConnect || {}), apiKey: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Resend (Emails & Notificaciones) */}
              <div className="rounded-xl border border-border/60 bg-surface/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-rose-500/15 text-rose-400 font-bold text-xs">
                      RS
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold">Resend (Notificaciones & Recibos por Email)</h4>
                      <p className="text-xs text-muted-foreground">Envío de comprobantes de remesas desde el dominio propio de la marca</p>
                    </div>
                  </div>
                  <Switch
                    checked={formApis.resend?.enabled ?? false}
                    onCheckedChange={(checked) =>
                      setFormApis((prev) => ({
                        ...prev,
                        resend: { ...(prev.resend || {}), enabled: checked },
                      }))
                    }
                  />
                </div>

                {formApis.resend?.enabled && (
                  <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2 border-t border-border/40">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Resend API Key</Label>
                      <Input
                        type="password"
                        placeholder="re_xxxxxxxx..."
                        value={formApis.resend?.apiKey || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            resend: { ...(prev.resend || {}), apiKey: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Email Remitente (From)</Label>
                      <Input
                        placeholder="notificaciones@tuempresa.com"
                        value={formApis.resend?.fromEmail || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            resend: { ...(prev.resend || {}), fromEmail: e.target.value },
                          }))
                        }
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Webhooks Salientes */}
              <div className="rounded-xl border border-border/60 bg-surface/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-purple-500/15 text-purple-400 font-bold text-xs">
                      WH
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold">Webhooks Salientes (Eventos en Tiempo Real)</h4>
                      <p className="text-xs text-muted-foreground">Notifica al backend externo de la empresa cuando una orden cambie de estado</p>
                    </div>
                  </div>
                  <Switch
                    checked={formApis.webhooks?.enabled ?? false}
                    onCheckedChange={(checked) =>
                      setFormApis((prev) => ({
                        ...prev,
                        webhooks: { ...(prev.webhooks || {}), enabled: checked },
                      }))
                    }
                  />
                </div>

                {formApis.webhooks?.enabled && (
                  <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2 border-t border-border/40">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-medium">URL de Webhook (Endpoint Receptor)</Label>
                      <Input
                        placeholder="https://api.tuempresa.com/webhooks/lajan"
                        value={formApis.webhooks?.url || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            webhooks: { ...(prev.webhooks || {}), url: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-medium">Clave Secreta para Validación de Firma</Label>
                      <Input
                        type="password"
                        placeholder="whsec_xxxxxxxx..."
                        value={formApis.webhooks?.secretKey || ""}
                        onChange={(e) =>
                          setFormApis((prev) => ({
                            ...prev,
                            webhooks: { ...(prev.webhooks || {}), secretKey: e.target.value },
                          }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
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
