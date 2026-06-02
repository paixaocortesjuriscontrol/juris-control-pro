import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

// Module-level cache to avoid refetching role on every navigation,
// which was causing AdminRoute to briefly see role=null and redirect.
const roleCache = new Map<string, AppRole | null>();
const roleStorageKey = (userId: string) => `user-role-cache:${userId}`;

function readStoredRole(userId: string): AppRole | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(roleStorageKey(userId));
  return value === "admin" || value === "coordenador" || value === "user" || value === "advogado_temporario"
    ? value
    : null;
}

function rememberRole(userId: string, role: AppRole) {
  roleCache.set(userId, role);
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(roleStorageKey(userId), role);
  }
}

export function useUserRole() {
  const { user } = useAuth();
  const cached = user ? (roleCache.get(user.id) ?? readStoredRole(user.id)) : null;
  const hasCached = !!cached;
  const [role, setRole] = useState<AppRole | null>(cached ?? null);
  const [loading, setLoading] = useState(!hasCached);

  useEffect(() => {
    let cancelled = false;
    async function fetchRole(attempt = 0): Promise<void> {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      // If we already have a cached role for this user, use it and skip refetch.
      const cachedRole = roleCache.get(user.id) ?? readStoredRole(user.id);
      if (cachedRole) {
        roleCache.set(user.id, cachedRole);
        setRole(cachedRole);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(10);

      const rows = (data ?? []) as Array<{ role: AppRole | null }>;
      const roles = rows
        .map((item) => item.role)
        .filter((item): item is AppRole => item !== null);

      const resolvedRole = roles.includes("admin")
        ? "admin"
        : roles.includes("coordenador")
          ? "coordenador"
          : roles[0] ?? null;

      if (error) {
        console.error("Error fetching user role:", error);
        // Do NOT cache or null-out on error. Keep `loading=true` and retry with
        // backoff so AdminRoute keeps showing the spinner instead of falsely
        // redirecting to "/" on transient network/auth blips.
        if (cancelled) return;
        if (attempt < 4) {
          const delay = Math.min(500 * 2 ** attempt, 4000);
          setTimeout(() => { if (!cancelled) void fetchRole(attempt + 1); }, delay);
          return;
        }
        // After exhausting retries, release the loading state so the UI is not
        // stuck forever; the cached null will redirect, but only as last resort.
        setLoading(false);
        return;
      } else {
        if (cancelled) return;
        if (resolvedRole) rememberRole(user.id, resolvedRole);
        setRole(resolvedRole);
      }
      setLoading(false);
    }

    void fetchRole();
    return () => { cancelled = true; };
  }, [user]);

  const isAdmin = role === "admin";
  const isCoordinator = role === "coordenador";
  const isAdminOrCoordinator = isAdmin || isCoordinator;

  return { role, loading, isAdmin, isCoordinator, isAdminOrCoordinator };
}
