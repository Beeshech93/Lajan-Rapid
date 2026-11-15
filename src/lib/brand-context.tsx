import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  type Tenant,
  DEFAULT_LAJAN_RAPID_TENANT,
  INITIAL_WHITE_LABEL_TENANTS,
} from "./whitelabel.types";
import { getWhiteLabelTenants } from "./whitelabel.functions";
import logoAsset from "@/assets/lajan-rapid-logo.png";

interface BrandContextType {
  currentBrand: Tenant;
  allBrands: Tenant[];
  isLoading: boolean;
  isCustomBrand: boolean;
  logoSrc: string;
  switchBrand: (slug: string) => void;
  resetToDefault: () => void;
  applyTheme: (tenant: Tenant) => void;
}

const BrandContext = createContext<BrandContextType | null>(null);

const STORAGE_KEY = "lajan_active_brand_slug";

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [activeSlug, setActiveSlug] = useState<string>("default");

  // Consultar todas las marcas disponibles desde el servidor
  const { data: serverTenants, isLoading } = useQuery({
    queryKey: ["white-label-tenants"],
    queryFn: () => getWhiteLabelTenants(),
    staleTime: 1000 * 60 * 5, // 5 min
    initialData: INITIAL_WHITE_LABEL_TENANTS,
  });

  const allBrands = useMemo(() => {
    const list = serverTenants && serverTenants.length > 0 ? serverTenants : [DEFAULT_LAJAN_RAPID_TENANT];
    if (!list.some((t) => t.isDefault || t.slug === "default")) {
      return [DEFAULT_LAJAN_RAPID_TENANT, ...list];
    }
    return list;
  }, [serverTenants]);

  // Detección inicial: URL query param (?brand= o ?tenant=) -> Hostname -> LocalStorage -> Default
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlBrand = urlParams.get("brand") || urlParams.get("tenant");

      if (urlBrand) {
        const clean = urlBrand.trim().toLowerCase();
        setActiveSlug(clean);
        localStorage.setItem(STORAGE_KEY, clean);
        return;
      }

      // Comprobar dominio / subdominio personalizado
      const currentHost = window.location.hostname.toLowerCase();
      const domainMatch = allBrands.find(
        (t) =>
          t.isActive &&
          !t.isDefault &&
          (t.domain?.toLowerCase() === currentHost ||
            (t.subdomain && `${t.subdomain.toLowerCase()}.${window.location.host}`.includes(currentHost)))
      );

      if (domainMatch) {
        setActiveSlug(domainMatch.slug);
        return;
      }

      // Comprobar guardado previo en localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setActiveSlug(saved);
      }
    } catch {
      // ignore
    }
  }, [allBrands]);

  // Tenant actual resuelto
  const currentBrand: Tenant = useMemo(() => {
    if (!activeSlug || activeSlug === "default" || activeSlug === "lajan-rapid") {
      return DEFAULT_LAJAN_RAPID_TENANT;
    }
    const found = allBrands.find(
      (b) => b.isActive && b.slug.toLowerCase() === activeSlug.toLowerCase()
    );
    return found || DEFAULT_LAJAN_RAPID_TENANT;
  }, [activeSlug, allBrands]);

  const isCustomBrand = currentBrand.id !== DEFAULT_LAJAN_RAPID_TENANT.id && currentBrand.slug !== "default";

  // Motor de personalización automática (CSS Variables, Title, Favicon)
  const applyTheme = (tenant: Tenant) => {
    if (typeof document === "undefined") return;

    const b = tenant.branding;
    const root = document.documentElement;

    // Inyectar variables CSS en el root
    if (b.primaryColor) {
      root.style.setProperty("--primary", b.primaryColor);
      root.style.setProperty("--ring", b.primaryColor);
      root.style.setProperty("--card-gradient-start", b.primaryColor);
    }
    if (b.primaryDarkColor || b.primaryColor) {
      root.style.setProperty("--primary-dark", b.primaryDarkColor || b.primaryColor);
    }
    if (b.accentColor) {
      root.style.setProperty("--accent", b.accentColor);
      root.style.setProperty("--card-gradient-end", b.accentColor);
    }
    if (b.borderRadius) {
      root.style.setProperty("--radius", b.borderRadius);
    }
    if (b.backgroundColor) {
      root.style.setProperty("--background", b.backgroundColor);
    }
    if (b.surfaceColor) {
      root.style.setProperty("--surface", b.surfaceColor);
      root.style.setProperty("--card", b.surfaceColor);
    }

    // Estilo dinámico inyectado para garantizar contraste y overrides
    let styleTag = document.getElementById("lajan-brand-dynamic-styles") as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "lajan-brand-dynamic-styles";
      document.head.appendChild(styleTag);
    }

    styleTag.innerHTML = `
      :root {
        --primary: ${b.primaryColor};
        --primary-dark: ${b.primaryDarkColor || b.primaryColor};
        --accent: ${b.accentColor};
        --ring: ${b.primaryColor};
        --card-gradient-start: ${b.primaryColor};
        --card-gradient-end: ${b.accentColor};
        ${b.borderRadius ? `--radius: ${b.borderRadius};` : ""}
        ${b.backgroundColor ? `--background: ${b.backgroundColor};` : ""}
        ${b.surfaceColor ? `--surface: ${b.surfaceColor}; --card: ${b.surfaceColor};` : ""}
      }
      .brand-accent-glow {
        box-shadow: 0 0 35px -5px ${b.primaryColor}40;
      }
    `;

    // Actualizar favicon si la marca tiene uno configurado
    if (b.faviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = b.faviconUrl;
    }

    // Actualizar título de la pestaña
    if (isCustomBrand) {
      const slogan = tenant.content.slogan ? ` — ${tenant.content.slogan}` : "";
      document.title = `${tenant.name}${slogan}`;
    }
  };

  // Re-aplicar personalización cuando cambia la marca
  useEffect(() => {
    applyTheme(currentBrand);
  }, [currentBrand, isCustomBrand]);

  const switchBrand = (slug: string) => {
    const clean = slug.trim().toLowerCase();
    setActiveSlug(clean);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, clean);
        // Actualizar URL sin recargar
        const url = new URL(window.location.href);
        if (clean === "default" || clean === "lajan-rapid") {
          url.searchParams.delete("brand");
          url.searchParams.delete("tenant");
        } else {
          url.searchParams.set("brand", clean);
        }
        window.history.replaceState({}, "", url.toString());
      } catch {
        // ignore
      }
    }
  };

  const resetToDefault = () => {
    switchBrand("default");
  };

  // Determinar logotipo actual (o el nativo oficial de Lajan Rapid)
  const logoSrc = currentBrand.branding.logoUrl?.trim()
    ? currentBrand.branding.logoUrl.trim()
    : logoAsset;

  return (
    <BrandContext.Provider
      value={{
        currentBrand,
        allBrands,
        isLoading,
        isCustomBrand,
        logoSrc,
        switchBrand,
        resetToDefault,
        applyTheme,
      }}
    >
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandContextType {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    // Si se invoca fuera del provider, retornar fallback seguro de Lajan Rapid
    return {
      currentBrand: DEFAULT_LAJAN_RAPID_TENANT,
      allBrands: [DEFAULT_LAJAN_RAPID_TENANT],
      isLoading: false,
      isCustomBrand: false,
      logoSrc: logoAsset,
      switchBrand: () => {},
      resetToDefault: () => {},
      applyTheme: () => {},
    };
  }
  return ctx;
}

