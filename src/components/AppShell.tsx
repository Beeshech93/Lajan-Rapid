import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Send,
  History,
  User,
  LifeBuoy,
  Shield,
  Briefcase,
  LogOut,
  Coins,
  Smartphone,
} from "lucide-react";
import type { ReactNode } from "react";
import logoAsset from "@/assets/lajan-rapid-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

const baseNav = [
  { to: "/dashboard", key: "nav.home", icon: Home },
  { to: "/enviar", key: "nav.send", icon: Send },
  { to: "/cripto", key: "nav.crypto", icon: Coins },
  { to: "/recargas", key: "nav.topups", icon: Smartphone },
  { to: "/historial", key: "nav.history", icon: History },
  { to: "/perfil", key: "nav.profile", icon: User },
];

const mobileNav = [
  { to: "/dashboard", key: "nav.home", icon: Home },
  { to: "/historial", key: "nav.history", icon: History },
  { to: "/cripto", key: "nav.crypto", icon: Coins },
  { to: "/perfil", key: "nav.profile", icon: User },
];

type NavEntry = { to: string; key: string; icon: typeof Home };

function NavItem({ item, active, label }: { item: NavEntry; active: boolean; label: string }) {
  return (
    <li>
      <Link
        to={item.to}
        className={cn(
          "press flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-semibold transition-colors",
          active ? "text-accent" : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "grid size-9 place-items-center rounded-xl transition-colors",
            active ? "bg-accent/12" : "bg-transparent",
          )}
        >
          <item.icon className="size-5" />
        </span>
        <span className="max-w-full truncate px-1">{label}</span>
      </Link>
    </li>
  );
}




export function AppShell({ children }: { children: ReactNode }) {
  const { profile, isAdmin, isAgent } = useProfile();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    ...baseNav,
    ...(isAgent ? [{ to: "/agente", key: "nav.agent", icon: Briefcase }] : []),
    ...(isAdmin ? [{ to: "/admin", key: "nav.admin", icon: Shield }] : []),
    { to: "/soporte", key: "nav.support", icon: LifeBuoy },
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar p-5 text-sidebar-foreground md:flex">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2">
          <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-white p-1">
            <img src={logoAsset.url} alt="Lajan Rapid" className="h-full w-full object-contain" />
          </span>
          <span className="font-display text-lg font-semibold">Lajan Rapid</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === item.to
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4" />
              {t(item.key)}
            </Link>
          ))}
        </nav>
        <div className="mt-4 space-y-2 border-t border-sidebar-border pt-4">
          <LanguageSwitcher className="w-full bg-sidebar-accent/40 text-sidebar-foreground" />
          <p className="truncate text-sm font-medium">{profile?.full_name || t("nav.account")}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground" onClick={signOut}>
            <LogOut className="size-4" /> {t("nav.signout")}
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b bg-card/90 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-md md:hidden">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-0.5">
              <img src={logoAsset.url} alt="Lajan Rapid" className="h-full w-full object-contain" />
            </span>
            <span className="truncate font-display font-semibold">Lajan Rapid</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <LanguageSwitcher className="h-9 w-[96px] text-xs" />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label={t("nav.signout")}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pb-10">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-lift backdrop-blur-xl md:hidden">
          <ul className="grid grid-cols-5 px-1.5 pt-1.5">
            {mobileNav.slice(0, 2).map((item) => (
              <NavItem key={item.to} item={item} active={pathname === item.to} label={t(item.key)} />
            ))}

            <li className="relative">
              <Link
                to="/enviar"
                aria-label={t("nav.send")}
                className="press absolute left-1/2 top-[-22px] grid size-14 -translate-x-1/2 place-items-center rounded-2xl bg-brand text-primary-foreground shadow-lift ring-4 ring-card"
              >
                <Plus className="size-6" />
              </Link>
            </li>

            {mobileNav.slice(2).map((item) => (
              <NavItem key={item.to} item={item} active={pathname === item.to} label={t(item.key)} />
            ))}
          </ul>
        </nav>

      </div>

    </div>
  );
}
