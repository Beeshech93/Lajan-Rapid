import { useEffect, useId } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function NotificationBell({ triggerClassName }: { triggerClassName?: string }) {
  const { user } = useProfile();
  const qc = useQueryClient();
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");

  const { data: notifs } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as Notification[];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc, instanceId]);

  const unreadCount = (notifs ?? []).filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    void qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && void markAllRead()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", triggerClassName)}
          aria-label="Notificaciones"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full p-0 text-[10px]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b p-3">
          <p className="text-sm font-semibold">Notificaciones</p>
        </div>
        <ScrollArea className="max-h-96">
          {(notifs ?? []).length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No tienes notificaciones todavía.
            </p>
          ) : (
            <ul className="divide-y">
              {(notifs ?? []).map((n) => (
                <li key={n.id} className={n.is_read ? "" : "bg-accent/5"}>
                  <div className="p-3">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Link
            to="/dashboard"
            className="block rounded-md px-2 py-1.5 text-center text-xs font-medium text-accent hover:bg-accent/10"
          >
            Ver todo en el inicio
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
