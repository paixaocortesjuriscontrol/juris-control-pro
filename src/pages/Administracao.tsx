import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, ShieldCheck, Users, UserPlus } from "lucide-react";
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUserData, setNewUserData] = useState({
    nome: "",
    email: "",
    senha: "",
    oab: "",
    telefone: "",
    role: "advogado" as AppRole,
  });
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

  async function handleCreateUser() {
    if (!newUserData.nome || !newUserData.email || !newUserData.senha) {
      toast.error("Preencha nome, email e senha");
      return;
    }

    if (newUserData.senha.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setCreating(true);

    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserData.email,
        password: newUserData.senha,
        options: {
          data: {
            nome: newUserData.nome,
          },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          toast.error("Este email já está cadastrado");
        } else {
          toast.error(authError.message);
        }
        setCreating(false);
        return;
      }

      if (!authData.user) {
        toast.error("Erro ao criar usuário");
        setCreating(false);
        return;
      }

      // Update profile with additional data
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nome: newUserData.nome,
          oab: newUserData.oab || null,
          telefone: newUserData.telefone || null,
        })
        .eq("id", authData.user.id);

      if (profileError) {
        console.error("Erro ao atualizar perfil:", profileError);
      }

      // Set user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role: newUserData.role })
        .eq("user_id", authData.user.id);

      if (roleError) {
        console.error("Erro ao definir role:", roleError);
      }

      toast.success(`Usuário ${newUserData.nome} criado com sucesso!`);
      setCreateDialogOpen(false);
      setNewUserData({
        nome: "",
        email: "",
        senha: "",
        oab: "",
        telefone: "",
        role: "advogado",
      });
      
      // Refresh users list
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar usuário");
    } finally {
      setCreating(false);
    }
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Administração</h1>
              <p className="text-muted-foreground">Gerencie os perfis dos usuários do sistema</p>
            </div>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Preencha os dados para criar um novo usuário no sistema
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Maria Silva"
                    value={newUserData.nome}
                    onChange={(e) => setNewUserData(prev => ({ ...prev, nome: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha Inicial *</Label>
                  <Input
                    id="senha"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newUserData.senha}
                    onChange={(e) => setNewUserData(prev => ({ ...prev, senha: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="oab">OAB</Label>
                    <Input
                      id="oab"
                      placeholder="Ex: 12345/DF"
                      value={newUserData.oab}
                      onChange={(e) => setNewUserData(prev => ({ ...prev, oab: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      placeholder="(00) 00000-0000"
                      value={newUserData.telefone}
                      onChange={(e) => setNewUserData(prev => ({ ...prev, telefone: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Perfil</Label>
                  <Select 
                    value={newUserData.role} 
                    onValueChange={(value) => setNewUserData(prev => ({ ...prev, role: value as AppRole }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateUser} disabled={creating}>
                  {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Cadastrar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
