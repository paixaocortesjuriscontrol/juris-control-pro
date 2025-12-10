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
import { Loader2, ShieldCheck, Users, UserPlus, Pencil, UserCheck, UserX, Upload, Building2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importando, setImportando] = useState(false);
  const [newUserData, setNewUserData] = useState({
    nome: "",
    email: "",
    senha: "",
    oab: "",
    telefone: "",
    role: "advogado" as AppRole,
  });
  const [editUserData, setEditUserData] = useState({
    nome: "",
    oab: "",
    telefone: "",
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
      // Store current admin session before creating user
      const { data: currentSession } = await supabase.auth.getSession();
      const adminSession = currentSession?.session;

      if (!adminSession) {
        toast.error("Sessão expirada. Faça login novamente.");
        setCreating(false);
        return;
      }

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

      const newUserId = authData.user.id;

      // Restore admin session immediately
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

      // Update profile with additional data (now as admin)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nome: newUserData.nome,
          oab: newUserData.oab || null,
          telefone: newUserData.telefone || null,
        })
        .eq("id", newUserId);

      if (profileError) {
        console.error("Erro ao atualizar perfil:", profileError);
      }

      // Set user role (now as admin)
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role: newUserData.role })
        .eq("user_id", newUserId);

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

  function handleEditUser(user: UserWithRole) {
    setEditingUser(user);
    setEditUserData({
      nome: user.nome,
      oab: user.oab ?? "",
      telefone: user.telefone ?? "",
    });
    setEditDialogOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    
    if (!editUserData.nome.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        nome: editUserData.nome.trim(),
        oab: editUserData.oab.trim() || null,
        telefone: editUserData.telefone.trim() || null,
      })
      .eq("id", editingUser.id);

    if (error) {
      toast.error("Erro ao atualizar dados do usuário");
      console.error(error);
    } else {
      toast.success("Dados atualizados com sucesso!");
      setUsers(prev => prev.map(u => 
        u.id === editingUser.id 
          ? { ...u, nome: editUserData.nome.trim(), oab: editUserData.oab.trim() || null, telefone: editUserData.telefone.trim() || null }
          : u
      ));
      setEditDialogOpen(false);
      setEditingUser(null);
    }

    setSaving(false);
  }

  async function handleToggleAtivo(userId: string, currentStatus: boolean) {
    setTogglingStatus(userId);

    const { error } = await supabase
      .from("profiles")
      .update({ ativo: !currentStatus })
      .eq("id", userId);

    if (error) {
      toast.error("Erro ao alterar status do usuário");
      console.error(error);
    } else {
      toast.success(!currentStatus ? "Usuário ativado com sucesso!" : "Usuário desativado com sucesso!");
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, ativo: !currentStatus } : u
      ));
    }

    setTogglingStatus(null);
  }

  async function handleImportarEquipe() {
    setImportando(true);
    try {
      const { data, error } = await supabase.functions.invoke('cadastrar-equipe');
      
      if (error) throw error;
      
      toast.success(`Importação concluída: ${data.created} usuários criados, ${data.errors} erros`);
      fetchUsers();
    } catch (error: any) {
      toast.error(`Erro na importação: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setImportando(false);
    }
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
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleImportarEquipe} disabled={importando}>
              {importando ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Importar Equipe
            </Button>
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
                  <TableHead>Filial</TableHead>
                  <TableHead>OAB</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Perfil Atual</TableHead>
                  <TableHead>Alterar Perfil</TableHead>
                  <TableHead className="w-12">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className={!user.ativo ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.avatar_url ?? undefined} />
                          <AvatarFallback className={user.ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>
                            {getInitials(user.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.nome}</span>
                          {!user.ativo && (
                            <span className="text-xs text-destructive flex items-center gap-1">
                              <UserX className="w-3 h-3" /> Desativado
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      {(user as any).filial ? (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Building2 className="w-3 h-3" />
                          {(user as any).filial}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.oab ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.telefone ?? "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.ativo ?? true}
                          onCheckedChange={() => handleToggleAtivo(user.id, user.ativo ?? true)}
                          disabled={togglingStatus === user.id}
                        />
                        {togglingStatus === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {user.ativo ? "Ativo" : "Inativo"}
                          </span>
                        )}
                      </div>
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
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Atualize os dados do usuário {editingUser?.nome}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome Completo *</Label>
                <Input
                  id="edit-nome"
                  placeholder="Ex: Maria Silva"
                  value={editUserData.nome}
                  onChange={(e) => setEditUserData(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-oab">OAB</Label>
                  <Input
                    id="edit-oab"
                    placeholder="Ex: 12345/DF"
                    value={editUserData.oab}
                    onChange={(e) => setEditUserData(prev => ({ ...prev, oab: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-telefone">Telefone</Label>
                  <Input
                    id="edit-telefone"
                    placeholder="(00) 00000-0000"
                    value={editUserData.telefone}
                    onChange={(e) => setEditUserData(prev => ({ ...prev, telefone: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Administracao;
