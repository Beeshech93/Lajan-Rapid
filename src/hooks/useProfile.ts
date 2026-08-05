import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "client" | "agent" | "admin";

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  country: string;
  language: string;
  kyc_status: "none" | "pending" | "approved" | "rejected";
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useProfile() {
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((p as Profile | null) ?? null);
    setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
    setLoading(false);
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }
    void load(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, sessionLoading]);

  return {
    user,
    profile,
    roles,
    isAdmin: roles.includes("admin"),
    isAgent: roles.includes("agent") || roles.includes("admin"),
    loading: loading || sessionLoading,
    reload: () => (user ? load(user.id) : Promise.resolve()),
  };
}
