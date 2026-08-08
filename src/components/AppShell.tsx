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
  Wallet,
  CreditCard,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

const baseNav = [
  { to: "/dashboard", key: "nav.home", icon: Home },
  { to: "/enviar", key: "nav.send", icon: Send },
  { to: "/billetera", key: "nav.wallet", icon: Wallet },
  { to: "/tarjeta", key: "nav.card", icon: CreditCard },
  { to: "/historial", key: "nav.history", icon: History },
  { to: "/perfil", key: "nav.profile", icon: User },
];


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
          <span className="grid size-9 place-items-center rounded-xl bg-mint font-display text-lg font-bold text-sidebar-primary-foreground">
            LR
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
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand font-display text-sm font-bold text-primary-foreground">
              LR
            </span>
            <span className="font-display font-semibold">Lajan Rapid</span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher className="h-9 w-[112px] text-xs" />
          <Button variant="ghost" size="icon" onClick={signOut} aria-label={t("nav.signout")}>
            <LogOut className="size-4" />
          </Button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card md:hidden">
          {baseNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                pathname === item.to ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {t(item.key)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
