import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type Tenant,
  type TenantBranding,
  type TenantContent,
  type TenantSettings,
  type TenantApis,
  DEFAULT_LAJAN_RAPID_TENANT,
  INITIAL_WHITE_LABEL_TENANTS,
} from "./whitelabel.types";

const CREDENTIALS_BACKUP_KEY = "white_label_tenants_data";

// Helper to normalize DB row into Tenant object
function rowToTenant(row: any): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    legalName: row.legal_name || row.legalName || "",
    isDefault: Boolean(row.is_default ?? row.isDefault),
    isActive: Boolean(row.is_active ?? row.isActive ?? true),
    domain: row.domain || null,
    subdomain: row.subdomain || null,
    branding: {
      primaryColor: row.branding?.primaryColor || "#10b981",
      primaryDarkColor: row.branding?.primaryDarkColor || "#059669",
      accentColor: row.branding?.accentColor || "#34d399",
      backgroundColor: row.branding?.backgroundColor || "#0b1426",
      surfaceColor: row.branding?.surfaceColor || "#121d33",
      textColor: row.branding?.textColor || "#f8fafc",
      fontFamily: row.branding?.fontFamily || "Sora, sans-serif",
      borderRadius: row.branding?.borderRadius || "1.25rem",
      logoUrl: row.branding?.logoUrl || "",
      logoDarkUrl: row.branding?.logoDarkUrl || "",
      faviconUrl: row.branding?.faviconUrl || "",
      appIconUrl: row.branding?.appIconUrl || "",
    },
    content: {
      slogan: row.content?.slogan || "",
      tagline: row.content?.tagline || "",
      supportEmail: row.content?.supportEmail || "",
      supportPhone: row.content?.supportPhone || "",
      supportWhatsapp: row.content?.supportWhatsapp || "",
      address: row.content?.address || "",
      termsUrl: row.content?.termsUrl || "",
      privacyUrl: row.content?.privacyUrl || "",
    },
    settings: {
      allowedOrigins: row.settings?.allowedOrigins || ["DO", "MX", "US", "CA", "BR", "CL", "ES", "FR"],
      allowedDestinations: row.settings?.allowedDestinations || ["HT"],
      feeMarkupPercent: Number(row.settings?.feeMarkupPercent || 0),
      feeMarkupFixed: Number(row.settings?.feeMarkupFixed || 0),
      enabledServices: {
        transfers: row.settings?.enabledServices?.transfers ?? true,
        topups: row.settings?.enabledServices?.topups ?? true,
        crypto: row.settings?.enabledServices?.crypto ?? true,
        virtualCards: row.settings?.enabledServices?.virtualCards ?? true,
      },
    },
    apis: {
      mercadoPago: {
        enabled: Boolean(row.apis?.mercadoPago?.enabled),
        publicKey: row.apis?.mercadoPago?.publicKey || "",
        accessToken: row.apis?.mercadoPago?.accessToken || "",
        webhookSecret: row.apis?.mercadoPago?.webhookSecret || "",
      },
      stripe: {
        enabled: Boolean(row.apis?.stripe?.enabled),
        publishableKey: row.apis?.stripe?.publishableKey || "",
        secretKey: row.apis?.stripe?.secretKey || "",
        webhookSecret: row.apis?.stripe?.webhookSecret || "",
      },
      bazik: {
        enabled: Boolean(row.apis?.bazik?.enabled),
        apiKey: row.apis?.bazik?.apiKey || "",
        apiSecret: row.apis?.bazik?.apiSecret || "",
        endpoint: row.apis?.bazik?.endpoint || "",
      },
      dingConnect: {
        enabled: Boolean(row.apis?.dingConnect?.enabled),
        apiKey: row.apis?.dingConnect?.apiKey || "",
      },
      resend: {
        enabled: Boolean(row.apis?.resend?.enabled),
        apiKey: row.apis?.resend?.apiKey || "",
        fromEmail: row.apis?.resend?.fromEmail || "",
      },
      webhooks: {
        enabled: Boolean(row.apis?.webhooks?.enabled),
        url: row.apis?.webhooks?.url || "",
        secretKey: row.apis?.webhooks?.secretKey || "",
      },
    },
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
  };
}

// Fallback loader from integration_credentials
async function loadFromFallback(supabaseAdmin: any): Promise<Tenant[]> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from("integration_credentials")
      .select("value")
      .eq("name", CREDENTIALS_BACKUP_KEY)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Respetar exactamente las marcas existentes (incluyendo eliminaciones del usuario)
        if (!parsed.some((t: Tenant) => t.isDefault || t.slug === "default")) {
          parsed.unshift(DEFAULT_LAJAN_RAPID_TENANT);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error reading white label from credentials fallback:", err);
  }
  return INITIAL_WHITE_LABEL_TENANTS;
}

// Fallback saver to integration_credentials
async function saveToFallback(supabaseAdmin: any, tenants: Tenant[]): Promise<void> {
  const now = new Date().toISOString();
  await (supabaseAdmin as any).from("integration_credentials").upsert(
    {
      name: CREDENTIALS_BACKUP_KEY,
      value: JSON.stringify(tenants),
      updated_at: now,
    },
    { onConflict: "name" }
  );
}

/**
 * Obtener todos los tenants (marcas) configuradas.
 * Garantiza que Lajan Rapid siempre esté presente como la marca predeterminada.
 */
export const getWhiteLabelTenants = createServerFn({ method: "GET" }).handler(
  async (): Promise<Tenant[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Intentar leer de la tabla `tenants`
      const { data, error } = await (supabaseAdmin as any)
        .from("tenants")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        const tenants = data.map(rowToTenant);
        if (!tenants.some((t: Tenant) => t.isDefault || t.slug === "default")) {
          tenants.unshift(DEFAULT_LAJAN_RAPID_TENANT);
        }
        return tenants;
      }

      // Si falla o no hay datos, usar el almacenamiento de respaldo
      const fallbackList = await loadFromFallback(supabaseAdmin);
      return fallbackList;
    } catch (e: any) {
      console.error("Error in getWhiteLabelTenants:", e?.message || e);
      return [DEFAULT_LAJAN_RAPID_TENANT];
    }
  }
);

/**
 * Buscar un tenant por slug o dominio.
 * Si no se encuentra, retorna la marca principal Lajan Rapid.
 */
export const getTenantBySlugOrDomain = createServerFn({ method: "GET" })
  .validator((input: { slugOrDomain?: string | null | undefined }) => input)
  .handler(async ({ data }): Promise<Tenant> => {
    const raw = (data.slugOrDomain || "").trim().toLowerCase();
    if (!raw || raw === "default" || raw === "lajan-rapid" || raw === "lajanrapid") {
      return DEFAULT_LAJAN_RAPID_TENANT;
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Buscar por slug, dominio o subdominio
      const { data: row, error } = await (supabaseAdmin as any)
        .from("tenants")
        .select("*")
        .or(`slug.eq.${raw},domain.eq.${raw},subdomain.eq.${raw}`)
        .eq("is_active", true)
        .maybeSingle();

      if (!error && row) {
        return rowToTenant(row);
      }

      // Buscar en el almacenamiento alternativo
      const fallbackList = await loadFromFallback(supabaseAdmin);
      const match = fallbackList.find(
        (t) =>
          t.isActive &&
          (t.slug.toLowerCase() === raw ||
            t.domain?.toLowerCase() === raw ||
            t.subdomain?.toLowerCase() === raw)
      );

      return match || DEFAULT_LAJAN_RAPID_TENANT;
    } catch {
      return DEFAULT_LAJAN_RAPID_TENANT;
    }
  });

export type SaveTenantInput = {
  id?: string | undefined;
  slug: string;
  name: string;
  legalName?: string | undefined;
  isDefault?: boolean | undefined;
  isActive?: boolean | undefined;
  domain?: string | null | undefined;
  subdomain?: string | null | undefined;
  branding?: TenantBranding | undefined;
  content?: TenantContent | undefined;
  settings?: TenantSettings | undefined;
  apis?: TenantApis | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

/**
 * Guardar o actualizar una marca (Tenant).
 * Protegido exclusivamente para Super Admins o Administradores autorizados.
 */
export const saveWhiteLabelTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: SaveTenantInput) => input)
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) {
      throw new Error("No tienes permisos administrativos para configurar marcas.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    const isLajanDefault = data.slug === "default" || data.isDefault === true;
    const tenantId = data.id || (isLajanDefault ? DEFAULT_LAJAN_RAPID_TENANT.id : crypto.randomUUID());

    const tenantToSave: Tenant = {
      id: tenantId,
      slug: data.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-"),
      name: data.name.trim(),
      legalName: data.legalName?.trim() || "",
      isDefault: isLajanDefault,
      isActive: data.isActive ?? true,
      domain: data.domain?.trim() ? data.domain.trim().toLowerCase() : null,
      subdomain: data.subdomain?.trim() ? data.subdomain.trim().toLowerCase() : null,
      branding: {
        primaryColor: data.branding?.primaryColor || "#10b981",
        primaryDarkColor: data.branding?.primaryDarkColor || "#059669",
        accentColor: data.branding?.accentColor || "#34d399",
        backgroundColor: data.branding?.backgroundColor || "#0b1426",
        surfaceColor: data.branding?.surfaceColor || "#121d33",
        textColor: data.branding?.textColor || "#f8fafc",
        fontFamily: data.branding?.fontFamily || "Sora, sans-serif",
        borderRadius: data.branding?.borderRadius || "1.25rem",
        logoUrl: data.branding?.logoUrl || "",
        logoDarkUrl: data.branding?.logoDarkUrl || "",
        faviconUrl: data.branding?.faviconUrl || "",
        appIconUrl: data.branding?.appIconUrl || "",
      },
      content: {
        slogan: data.content?.slogan || "",
        tagline: data.content?.tagline || "",
        supportEmail: data.content?.supportEmail || "",
        supportPhone: data.content?.supportPhone || "",
        supportWhatsapp: data.content?.supportWhatsapp || "",
        address: data.content?.address || "",
        termsUrl: data.content?.termsUrl || "",
        privacyUrl: data.content?.privacyUrl || "",
      },
      settings: {
        allowedOrigins: data.settings?.allowedOrigins || ["DO", "MX", "US", "CA", "BR", "CL", "ES", "FR"],
        allowedDestinations: data.settings?.allowedDestinations || ["HT"],
        feeMarkupPercent: Number(data.settings?.feeMarkupPercent || 0),
        feeMarkupFixed: Number(data.settings?.feeMarkupFixed || 0),
        enabledServices: {
          transfers: data.settings?.enabledServices?.transfers ?? true,
          topups: data.settings?.enabledServices?.topups ?? true,
          crypto: data.settings?.enabledServices?.crypto ?? true,
          virtualCards: data.settings?.enabledServices?.virtualCards ?? true,
        },
      },
      apis: {
        mercadoPago: {
          enabled: Boolean(data.apis?.mercadoPago?.enabled),
          publicKey: data.apis?.mercadoPago?.publicKey || "",
          accessToken: data.apis?.mercadoPago?.accessToken || "",
          webhookSecret: data.apis?.mercadoPago?.webhookSecret || "",
        },
        stripe: {
          enabled: Boolean(data.apis?.stripe?.enabled),
          publishableKey: data.apis?.stripe?.publishableKey || "",
          secretKey: data.apis?.stripe?.secretKey || "",
          webhookSecret: data.apis?.stripe?.webhookSecret || "",
        },
        bazik: {
          enabled: Boolean(data.apis?.bazik?.enabled),
          apiKey: data.apis?.bazik?.apiKey || "",
          apiSecret: data.apis?.bazik?.apiSecret || "",
          endpoint: data.apis?.bazik?.endpoint || "",
        },
        dingConnect: {
          enabled: Boolean(data.apis?.dingConnect?.enabled),
          apiKey: data.apis?.dingConnect?.apiKey || "",
        },
        resend: {
          enabled: Boolean(data.apis?.resend?.enabled),
          apiKey: data.apis?.resend?.apiKey || "",
          fromEmail: data.apis?.resend?.fromEmail || "",
        },
        webhooks: {
          enabled: Boolean(data.apis?.webhooks?.enabled),
          url: data.apis?.webhooks?.url || "",
          secretKey: data.apis?.webhooks?.secretKey || "",
        },
      },
      createdAt: data.createdAt || now,
      updatedAt: now,
    };

    // Intentar guardar en la tabla `tenants`
    let tableError: any = null;
    try {
      const dbPayload = {
        id: tenantToSave.id,
        slug: tenantToSave.slug,
        name: tenantToSave.name,
        legal_name: tenantToSave.legalName,
        is_default: tenantToSave.isDefault,
        is_active: tenantToSave.isActive,
        domain: tenantToSave.domain,
        subdomain: tenantToSave.subdomain,
        branding: tenantToSave.branding,
        content: tenantToSave.content,
        settings: tenantToSave.settings,
        apis: tenantToSave.apis,
        updated_at: now,
      };

      const res = await (supabaseAdmin as any).from("tenants").upsert(dbPayload, { onConflict: "id" });
      tableError = res.error;
    } catch (err: any) {
      tableError = err;
    }

    // Sincronizar siempre en el respaldo integration_credentials para máxima redundancia
    try {
      const currentList = await loadFromFallback(supabaseAdmin);
      const filtered = currentList.filter((t) => t.id !== tenantToSave.id && t.slug !== tenantToSave.slug);
      filtered.push(tenantToSave);
      await saveToFallback(supabaseAdmin, filtered);
    } catch (err) {
      console.error("Error updating fallback store:", err);
    }

    if (tableError) {
      console.warn("Notice: Saved to fallback storage. DB table reported:", tableError.message || tableError);
    }

    return { ok: true, tenant: tenantToSave };
  });

/**
 * Eliminar una marca aliada.
 * Lajan Rapid (isDefault: true) NO se puede eliminar jamás.
 */
export const deleteWhiteLabelTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) {
      throw new Error("No tienes permisos de administrador para eliminar marcas.");
    }

    const target = data.tenantId?.trim();
    if (!target || target === DEFAULT_LAJAN_RAPID_TENANT.id || target === "default" || target === "lajan-rapid") {
      throw new Error("No es posible eliminar la marca principal Lajan Rapid.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Eliminar de la base de datos Supabase (por id o por slug)
    try {
      await (supabaseAdmin as any)
        .from("tenants")
        .delete()
        .or(`id.eq.${target},slug.eq.${target}`)
        .eq("is_default", false);
    } catch (err) {
      console.warn("Could not delete from tenants table:", err);
    }

    // 2. Eliminar del almacenamiento fallback
    try {
      const currentList = await loadFromFallback(supabaseAdmin);
      const updated = currentList.filter(
        (t) => t.id !== target && t.slug !== target && !t.isDefault && t.slug !== "default"
      );
      if (!updated.some((t) => t.isDefault || t.slug === "default")) {
        updated.unshift(DEFAULT_LAJAN_RAPID_TENANT);
      }
      await saveToFallback(supabaseAdmin, updated);
    } catch (err) {
      console.error("Error deleting from fallback store:", err);
    }

    return { ok: true };
  });

export type UploadWhiteLabelAssetInput = {
  fileName: string;
  fileBase64: string;
  contentType?: string | undefined;
  assetType: "logo" | "favicon" | "logoDark" | "appIcon";
};

/**
 * Subir logotipo, favicon o ícono de aplicación para una marca White Label.
 * Almacena en Supabase Storage (bucket público 'whitelabel-assets' con fallback a 'ad-banner').
 */
export const uploadWhiteLabelAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: UploadWhiteLabelAssetInput) => input)
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) {
      throw new Error("No tienes permisos de administrador para subir recursos.");
    }

    if (!data.fileBase64 || !data.fileName) {
      throw new Error("El archivo de imagen es obligatorio.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Limpiar base64
    const base64Content = data.fileBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Content, "base64");
    const ext = data.fileName.split(".").pop()?.toLowerCase() || "png";
    const safeExt = ["png", "jpg", "jpeg", "svg", "webp", "ico"].includes(ext) ? ext : "png";
    const path = `${data.assetType || "asset"}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${safeExt}`;
    const contentType =
      data.contentType ||
      (safeExt === "svg"
        ? "image/svg+xml"
        : safeExt === "ico"
        ? "image/x-icon"
        : `image/${safeExt}`);

    // Asegurar existencia del bucket whitelabel-assets si es posible
    try {
      await supabaseAdmin.storage.createBucket("whitelabel-assets", { public: true });
    } catch {
      // Ignorar si ya existe
    }

    // 1. Intentar subir al bucket whitelabel-assets
    let publicUrl = "";
    const { error: uploadError } = await supabaseAdmin.storage
      .from("whitelabel-assets")
      .upload(path, buffer, {
        contentType,
        upsert: true,
      });

    if (!uploadError) {
      const { data: pubData } = supabaseAdmin.storage.from("whitelabel-assets").getPublicUrl(path);
      publicUrl = pubData.publicUrl;
    } else {
      console.warn("whitelabel-assets bucket upload failed, trying ad-banner bucket:", uploadError);
      // 2. Fallback al bucket público ad-banner
      const { error: fbError } = await supabaseAdmin.storage
        .from("ad-banner")
        .upload(`wl-${path}`, buffer, {
          contentType,
          upsert: true,
        });

      if (fbError) {
        throw new Error(
          "Error al subir la imagen al almacenamiento: " + (uploadError.message || fbError.message)
        );
      }

      const { data: pubData } = supabaseAdmin.storage.from("ad-banner").getPublicUrl(`wl-${path}`);
      publicUrl = pubData.publicUrl;
    }

    return { publicUrl };
  });
