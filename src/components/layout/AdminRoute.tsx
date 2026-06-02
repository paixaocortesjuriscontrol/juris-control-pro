import { ReactNode } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isAdminOrCoordinator, loading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdminOrCoordinator) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">Acesso restrito</h1>
            <p className="text-sm text-muted-foreground">
              Seu perfil atual não permite acessar esta área.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/painel-controle">Voltar ao painel</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
