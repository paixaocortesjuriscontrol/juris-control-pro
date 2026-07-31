import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ADVOGADO_TEMPORARIO_ALLOWED = new Set([
  "/analise-djen",
  "/termos-djen",
  "/comparar-dj-santander",
  "/errata-djen",
  "/notificacoes",
]);

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const location = useLocation();
  const { pathname } = location;

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const destination = `${pathname}${location.search ?? ""}${location.hash ?? ""}`;
    // Mantém também o fallback em sessionStorage para navegadores que removam
    // a query string durante autenticação, mas leva o destino na própria URL.
    try {
      sessionStorage.setItem("redirectAfterLogin", destination);
    } catch {}
    return (
      <Navigate
        to={`/auth?redirect=${encodeURIComponent(destination)}`}
        replace
        state={{ from: location }}
      />
    );
  }

  if (role === "advogado_temporario" && !ADVOGADO_TEMPORARIO_ALLOWED.has(pathname)) {
    return <Navigate to="/analise-djen" replace />;
  }

  return <>{children}</>;
}
