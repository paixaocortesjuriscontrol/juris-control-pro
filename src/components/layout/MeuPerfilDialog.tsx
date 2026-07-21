import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface MeuPerfilDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (nome?: string, avatarUrl?: string | null) => void;
}

export function MeuPerfilDialog({ open, onOpenChange, onSaved }: MeuPerfilDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    nome: "",
    senha: "",
    filial: "",
    oab: "",
    telefone: "",
  });

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoading(true);
    supabase
      .from("profiles")
      .select("nome, filial, oab, telefone, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setForm({
          nome: data?.nome ?? "",
          senha: "",
          filial: data?.filial ?? "",
          oab: data?.oab ?? "",
          telefone: data?.telefone ?? "",
        });
        setAvatarUrl((data as any)?.avatar_url ?? null);
        setLoading(false);
      });
  }, [open, user?.id]);

  function getInitials() {
    const nome = form.nome || user?.email || "";
    const parts = nome.trim().split(/\s+/);
    if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return nome.substring(0, 2).toUpperCase();
  }

  async function handleUploadAvatar(file: File) {
    if (!user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB)");
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      // Gera URL assinada com validade longa (1 ano)
      const { data: signed, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr) throw signErr;

      const url = signed.signedUrl;
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url } as any)
        .eq("id", user.id);
      if (profErr) throw profErr;

      setAvatarUrl(url);
      onSaved?.(undefined, url);
      toast.success("Foto de perfil atualizada");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar foto");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    if (!user?.id) return;
    setUploadingAvatar(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null } as any)
        .eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(null);
      onSaved?.(undefined, null);
      toast.success("Foto removida");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover foto");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSalvar() {
    if (!user?.id) return;
    if (!form.nome.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    if (form.senha && form.senha.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nome: form.nome.trim(),
          filial: form.filial.trim() || null,
          oab: form.oab.trim() || null,
          telefone: form.telefone.trim() || null,
        })
        .eq("id", user.id);
      if (profileError) throw profileError;

      if (form.senha) {
        const { error: pwError } = await supabase.auth.updateUser({ password: form.senha });
        if (pwError) throw pwError;
      }

      onSaved?.(form.nome.trim(), avatarUrl);
      toast.success("Perfil atualizado com sucesso");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnviarTesteWhatsApp() {
    const tel = form.telefone.trim();
    if (!tel) {
      toast.error("Preencha um telefone para enviar o teste");
      return;
    }
    setSendingTest(true);
    try {
      const now = new Date();
      const mensagem = `✅ *Teste WhatsApp - JurisControl*\n\nUsuário: *${form.nome.trim()}*\nData/Hora: ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n\nSe você recebeu esta mensagem, o envio está funcionando.`;
      const { error } = await supabase.functions.invoke("enviar-whatsapp-zapi", {
        body: { telefones: [tel], mensagem, tipo: "teste" },
      });
      if (error) throw error;
      toast.success("Teste enviado! Confira seu WhatsApp.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar teste");
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
          <DialogDescription>Atualize seus dados pessoais</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadAvatar(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar || loading}
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Enviar foto
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remover
                </Button>
              )}
              <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP (máx. 5MB).</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="perfil-nome">Nome Completo *</Label>
            <Input
              id="perfil-nome"
              value={form.nome}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="perfil-email">Email</Label>
            <Input id="perfil-email" type="email" value={user?.email ?? ""} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              Para alterar o email, solicite a um administrador.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="perfil-senha">Nova Senha (deixe em branco para manter)</Label>
            <Input
              id="perfil-senha"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={form.senha}
              onChange={(e) => setForm((p) => ({ ...p, senha: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="perfil-filial">Filial</Label>
              <Select
                value={form.filial || "sem_filial"}
                onValueChange={(v) => setForm((p) => ({ ...p, filial: v === "sem_filial" ? "" : v }))}
              >
                <SelectTrigger id="perfil-filial">
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
              <Label htmlFor="perfil-oab">OAB</Label>
              <Input
                id="perfil-oab"
                placeholder="Ex: 12345/DF"
                value={form.oab}
                onChange={(e) => setForm((p) => ({ ...p, oab: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="perfil-telefone">Telefone</Label>
            <Input
              id="perfil-telefone"
              placeholder="(00) 00000-0000"
              value={form.telefone}
              onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="mr-auto"
            onClick={handleEnviarTesteWhatsApp}
            disabled={sendingTest || loading}
          >
            {sendingTest && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enviar teste WhatsApp
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={saving || loading}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}