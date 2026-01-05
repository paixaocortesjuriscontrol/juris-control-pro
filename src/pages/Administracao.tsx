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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldCheck, Users, UserPlus, Pencil, Filter, Clock, History, CalendarIcon, X, Server } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { InfoSistemaTab } from "@/components/admin/InfoSistemaTab";

type AppRole = Database["public"]["Enums"]["app_role"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface UserWithRole extends Profile {
  role: AppRole | null;
}

interface LoginHistory {
  id: string;
  user_id: string;
  email: string | null;
  logged_in_at: string;
  user_name?: string;
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
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [filialFilter, setFilialFilter] = useState<string>("todas");
  const [activeTab, setActiveTab] = useState("usuarios");
  const [historyStartDate, setHistoryStartDate] = useState<Date | undefined>(undefined);
  const [historyEndDate, setHistoryEndDate] = useState<Date | undefined>(undefined);
  const [historyUserFilter, setHistoryUserFilter] = useState<string>("todos");
  const [newUserData, setNewUserData] = useState({
    nome: "",
    email: "",
    senha: "",
    oab: "",
    telefone: "",
    filial: "",
    role: "advogado" as AppRole,
  });
  const [editUserData, setEditUserData] = useState({
    nome: "",
    email: "",
    oab: "",
    telefone: "",
    filial: "",
    role: "advogado" as AppRole,
    senha: "",
  });
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const filiais = [...new Set(users.map(u => (u as any).filial).filter(Boolean))].sort();
  const filteredUsers = filialFilter === "todas" 
    ? users 
    : users.filter(u => (u as any).filial === filialFilter);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("Acesso negado. Apenas administradores podem acessar esta página.");
      navigate("/");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === "historico") {
      fetchLoginHistory();
    }
  }, [activeTab, historyStartDate, historyEndDate, historyUserFilter, users]);

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

  async function fetchLoginHistory() {
    setLoadingHistory(true);
    
    let query = supabase
      .from("historico_login")
      .select("*")
      .order("logged_in_at", { ascending: false })
      .limit(500);

    // Apply date filters
    if (historyStartDate) {
      query = query.gte("logged_in_at", startOfDay(historyStartDate).toISOString());
    }
    if (historyEndDate) {
      query = query.lte("logged_in_at", endOfDay(historyEndDate).toISOString());
    }
    if (historyUserFilter && historyUserFilter !== "todos") {
      query = query.eq("user_id", historyUserFilter);
    }

    const { data: history, error: historyError } = await query;

    if (historyError) {
      toast.error("Erro ao carregar histórico de login");
      console.error(historyError);
      setLoadingHistory(false);
      return;
    }

    // Map user names from the users list
    const historyWithNames: LoginHistory[] = (history ?? []).map(h => ({
      ...h,
      user_name: users.find(u => u.id === h.user_id)?.nome || h.email || "Desconhecido",
    }));

    setLoginHistory(historyWithNames);
    setLoadingHistory(false);
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

      // Atualizar profile com dados adicionais (via Edge Function com Service Role)
      const { error: profileError } = await supabase.functions.invoke("atualizar-usuario", {
        body: {
          userId: newUserId,
          nome: newUserData.nome.trim(),
          oab: newUserData.oab.trim() || null,
          telefone: newUserData.telefone.trim() || null,
          filial: newUserData.filial.trim() || null,
        },
      });

      if (profileError) {
        console.error("Erro ao atualizar profile via edge function:", profileError);
        toast.error(profileError.message || "Erro ao salvar dados do perfil");
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
        filial: "",
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
      email: user.email,
      oab: user.oab ?? "",
      telefone: user.telefone ?? "",
      filial: (user as any).filial ?? "",
      role: user.role ?? "advogado",
      senha: "",
    });
    setEditDialogOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    
    if (!editUserData.nome.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }

    if (!editUserData.email.trim()) {
      toast.error("O email é obrigatório");
      return;
    }

    if (editUserData.senha && editUserData.senha.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setSaving(true);

    try {
      const emailChanged = editUserData.email.trim() !== editingUser.email;
      const passwordChanged = editUserData.senha.trim().length > 0;

      // Atualiza profile + (se necessário) email/senha no Auth via Edge Function (Service Role)
      const { error: updateError } = await supabase.functions.invoke("atualizar-usuario", {
        body: {
          userId: editingUser.id,
          email: emailChanged ? editUserData.email.trim() : undefined,
          password: passwordChanged ? editUserData.senha.trim() : undefined,
          nome: editUserData.nome.trim(),
          oab: editUserData.oab.trim() || null,
          telefone: editUserData.telefone.trim() || null,
          filial: editUserData.filial.trim() || null,
        },
      });

      if (updateError) {
        throw new Error(updateError.message || "Erro ao atualizar usuário");
      }

      // Update role if changed
      if (editUserData.role !== editingUser.role) {
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", editingUser.id)
          .maybeSingle();

        if (existingRole) {
          await supabase
            .from("user_roles")
            .update({ role: editUserData.role })
            .eq("user_id", editingUser.id);
        } else {
          await supabase
            .from("user_roles")
            .insert({ user_id: editingUser.id, role: editUserData.role });
        }
      }

      toast.success("Usuário atualizado com sucesso!");
      setUsers(prev => prev.map(u => 
        u.id === editingUser.id 
          ? { 
              ...u, 
              nome: editUserData.nome.trim(), 
              email: emailChanged ? editUserData.email.trim() : u.email,
              oab: editUserData.oab.trim() || null, 
              telefone: editUserData.telefone.trim() || null, 
              filial: editUserData.filial.trim() || null,
              role: editUserData.role,
            } as any
          : u
      ));
      setEditDialogOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar usuário");
      console.error(error);
    }

    setSaving(false);
  }

  async function handleEnviarTesteWhatsApp() {
    if (!editingUser) return;

    const tel = editUserData.telefone.trim();
    if (!tel) {
      toast.error("Preencha um telefone para enviar o teste");
      return;
    }

    setSendingTest(true);
    try {
      const now = new Date();
      const mensagem = `✅ *Teste WhatsApp - JurisControl*\n\nUsuário: *${editUserData.nome.trim()}*\nData/Hora: ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n\nSe você recebeu esta mensagem, o envio está funcionando.`;

      const { error } = await supabase.functions.invoke("enviar-whatsapp-zapi", {
        body: {
          telefones: [tel],
          mensagem,
          tipo: "teste",
        },
      });

      if (error) throw error;

      toast.success("Teste enviado! Confira o WhatsApp do usuário.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar teste");
      console.error(err);
    } finally {
      setSendingTest(false);
    }
  }

  async function handleToggleAtivo(userId: string, currentStatus: boolean) {
    setTogglingStatus(userId);

    const { error } = await supabase.functions.invoke("atualizar-usuario", {
      body: {
        userId,
        ativo: !currentStatus,
      },
    });

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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="filial">Filial</Label>
                    <Select 
                      value={newUserData.filial || "sem_filial"} 
                      onValueChange={(value) => setNewUserData(prev => ({ ...prev, filial: value === "sem_filial" ? "" : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a filial" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem_filial">Sem filial</SelectItem>
                        <SelectItem value="Matriz DF">Matriz DF</SelectItem>
                        <SelectItem value="filial GO">filial GO</SelectItem>
                        <SelectItem value="filial SP">filial SP</SelectItem>
                      </SelectContent>
                    </Select>
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="usuarios" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="sistema" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Info Sistema
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Usuários do Sistema
                    </CardTitle>
                    <CardDescription>
                      {filteredUsers.length} de {users.length} usuário(s) cadastrado(s)
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={filialFilter} onValueChange={setFilialFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filtrar por filial" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as filiais</SelectItem>
                        {filiais.map((filial) => (
                          <SelectItem key={filial} value={filial}>{filial}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>OAB</TableHead>
                      <TableHead>Filial</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead className="w-12">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className={!user.ativo ? "opacity-50" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar_url ?? undefined} />
                              <AvatarFallback className={`text-xs ${user.ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                {getInitials(user.nome)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{user.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.oab ?? "-"}
                        </TableCell>
                        <TableCell>
                          {(user as any).filial ? (
                            <Badge variant="outline" className="text-xs">
                              {(user as any).filial}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={user.ativo ?? true}
                              onCheckedChange={() => handleToggleAtivo(user.id, user.ativo ?? true)}
                              disabled={togglingStatus === user.id}
                            />
                            {togglingStatus === user.id && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.role ? (
                            <Badge className={`text-xs ${roleBadgeColors[user.role]}`}>
                              {roleLabels[user.role]}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Sem perfil</Badge>
                          )}
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
          </TabsContent>

          <TabsContent value="historico" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Histórico de Acesso
                    </CardTitle>
                    <CardDescription>
                      {loginHistory.length} registro(s) encontrado(s)
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* User Filter */}
                    <Select value={historyUserFilter} onValueChange={setHistoryUserFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filtrar por usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os usuários</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Start Date */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[140px] justify-start text-left font-normal",
                            !historyStartDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {historyStartDate ? format(historyStartDate, "dd/MM/yyyy") : "Data início"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={historyStartDate}
                          onSelect={setHistoryStartDate}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>

                    {/* End Date */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[140px] justify-start text-left font-normal",
                            !historyEndDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {historyEndDate ? format(historyEndDate, "dd/MM/yyyy") : "Data fim"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={historyEndDate}
                          onSelect={setHistoryEndDate}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>

                    {/* Clear Filters */}
                    {(historyStartDate || historyEndDate || historyUserFilter !== "todos") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setHistoryStartDate(undefined);
                          setHistoryEndDate(undefined);
                          setHistoryUserFilter("todos");
                        }}
                        title="Limpar filtros"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : loginHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum registro de login encontrado
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Data e Hora</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loginHistory.map((log) => {
                        const zonedDate = toZonedTime(new Date(log.logged_in_at), "America/Sao_Paulo");
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">
                              {log.user_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {log.email || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                {format(zonedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sistema" className="mt-6">
            <InfoSistemaTab />
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Atualize os dados do usuário {editingUser?.nome}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome Completo *</Label>
                <Input
                  id="edit-nome"
                  placeholder="Ex: Maria Silva"
                  value={editUserData.nome}
                  onChange={(e) => setEditUserData(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={editUserData.email}
                  onChange={(e) => setEditUserData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-senha">Nova Senha (deixe em branco para manter)</Label>
                <Input
                  id="edit-senha"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={editUserData.senha}
                  onChange={(e) => setEditUserData(prev => ({ ...prev, senha: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-filial">Filial</Label>
                  <Select 
                    value={editUserData.filial || "sem_filial"} 
                    onValueChange={(value) => setEditUserData(prev => ({ ...prev, filial: value === "sem_filial" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a filial" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem_filial">Sem filial</SelectItem>
                      <SelectItem value="Matriz DF">Matriz DF</SelectItem>
                      <SelectItem value="filial GO">filial GO</SelectItem>
                      <SelectItem value="filial SP">filial SP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Perfil</Label>
                  <Select 
                    value={editUserData.role} 
                    onValueChange={(value) => setEditUserData(prev => ({ ...prev, role: value as AppRole }))}
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
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="mr-auto"
                onClick={handleEnviarTesteWhatsApp}
                disabled={sendingTest}
              >
                {sendingTest && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar teste WhatsApp
              </Button>
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
