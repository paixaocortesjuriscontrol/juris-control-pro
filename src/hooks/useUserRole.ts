import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(10);

      const roles = Array.isArray(data)
        ? data.map((item) => item.role)
        : data?.role
          ? [data.role]
          : [];

      const resolvedRole = roles.includes("admin")
        ? "admin"
        : roles.includes("coordenador")
          ? "coordenador"
          : roles[0] ?? null;

      if (error) {
        console.error("Error fetching user role:", error);
        setRole(null);
      } else {
        setRole(resolvedRole);
      }
      setLoading(false);
    }

    fetchRole();
  }, [user]);

  const isAdmin = role === "admin";
  const isCoordinator = role === "coordenador";
  const isAdminOrCoordinator = isAdmin || isCoordinator;

  return { role, loading, isAdmin, isCoordinator, isAdminOrCoordinator };
}
