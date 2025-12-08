import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface UserWithRole extends Profile {
  role: AppRole | null;
}

const roleLabels: Record<AppRole, string> = {
  admin: "Administrador",
  coordenador: "Advogado Coordenador",
  advogado: "Advogado",
  estagiario: "Estagiário",
  assistente: "Assistente",
  secretaria: "Secretária",
};

const roleBadgeColors: Record<AppRole, string> = {
  admin: "bg-destructive text-destructive-foreground",
  coordenador: "bg-[hsl(var(--area-empresarial))] text-white",
  advogado: "bg-primary text-primary-foreground",
  estagiario: "bg-[hsl(var(--area-civil))] text-white",
  assistente: "bg-[hsl(var(--area-trabalhista))] text-white",
  secretaria: "bg-accent text-accent-foreground",
};

const Administracao = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("Acesso negado. Apenas administradores podem acessar esta página.");
      navigate("/");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("nome");

    if (profilesError) {
      toast.error("Erro ao carregar usuários");
      console.error(profilesError);
      setLoading(false);
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      toast.error("Erro ao carregar roles");
      console.error(rolesError);
      setLoading(false);
      return;
    }

    const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) ?? []);
    
    const usersWithRoles: UserWithRole[] = (profiles ?? []).map(profile => ({
      ...profile,
      role: rolesMap.get(profile.id) ?? null,
    }));

    setUsers(usersWithRoles);
    setLoading(false);
  }

  async function handleRoleChange(userId: string, newRole: AppRole) {
    setUpdating(userId);

    const { data: existingRole, error: fetchError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      toast.error("Erro ao verificar role atual");
      setUpdating(null);
      return;
    }

    let error;

    if (existingRole) {
      const { error: updateError } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });
      error = insertError;
    }

    if (error) {
      toast.error("Erro ao atualizar perfil");
      console.error(error);
    } else {
      toast.success("Perfil atualizado com sucesso!");
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }

    setUpdating(null);
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  if (roleLoading || loading) {
    return (
      <MainLayout title="Administração">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <MainLayout title="Administração" subtitle="Gerencie os perfis dos usuários do sistema">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Administração</h1>
            <p className="text-muted-foreground">Gerencie os perfis dos usuários do sistema</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Usuários do Sistema
            </CardTitle>
            <CardDescription>
              {users.length} usuário(s) cadastrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>OAB</TableHead>
                  <TableHead>Perfil Atual</TableHead>
                  <TableHead>Alterar Perfil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(user.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.oab ?? "-"}
                    </TableCell>
                    <TableCell>
                      {user.role ? (
                        <Badge className={roleBadgeColors[user.role]}>
                          {roleLabels[user.role]}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Sem perfil</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role ?? ""}
                        onValueChange={(value) => handleRoleChange(user.id, value as AppRole)}
                        disabled={updating === user.id}
                      >
                        <SelectTrigger className="w-48">
                          {updating === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <SelectValue placeholder="Selecione um perfil" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="coordenador">Advogado Coordenador</SelectItem>
                          <SelectItem value="advogado">Advogado</SelectItem>
                          <SelectItem value="estagiario">Estagiário</SelectItem>
                          <SelectItem value="assistente">Assistente</SelectItem>
                          <SelectItem value="secretaria">Secretária</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Administracao;
