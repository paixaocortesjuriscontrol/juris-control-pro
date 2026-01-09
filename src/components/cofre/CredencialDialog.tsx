import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Eye, EyeOff, Upload, ShieldCheck, X, FileKey } from "lucide-react";
import { CofreSenha } from "@/hooks/useCofreSenhas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { sanitizeFileName } from "@/lib/utils";

interface CredencialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credencial?: CofreSenha | null;
  onSave: (dados: any) => void;
  saving?: boolean;
}

const SISTEMAS = [
  { value: "PJe", label: "PJe - Processo Judicial Eletrônico" },
  { value: "ESAJ", label: "ESAJ - E-SAJ" },
  { value: "PROJUDI", label: "PROJUDI" },
  { value: "EPROC", label: "EPROC" },
  { value: "TUCUJURIS", label: "TUCUJURIS" },
  { value: "SAJ", label: "SAJ" },
  { value: "THEMIS", label: "THEMIS" },
  { value: "Outro", label: "Outro Sistema" },
];

const TRIBUNAIS = [
  // Estaduais
  { value: "TJAC", label: "TJAC - Acre" },
  { value: "TJAL", label: "TJAL - Alagoas" },
  { value: "TJAM", label: "TJAM - Amazonas" },
  { value: "TJAP", label: "TJAP - Amapá" },
  { value: "TJBA", label: "TJBA - Bahia" },
  { value: "TJCE", label: "TJCE - Ceará" },
  { value: "TJDFT", label: "TJDFT - Distrito Federal" },
  { value: "TJES", label: "TJES - Espírito Santo" },
  { value: "TJGO", label: "TJGO - Goiás" },
  { value: "TJMA", label: "TJMA - Maranhão" },
  { value: "TJMG", label: "TJMG - Minas Gerais" },
  { value: "TJMS", label: "TJMS - Mato Grosso do Sul" },
  { value: "TJMT", label: "TJMT - Mato Grosso" },
  { value: "TJPA", label: "TJPA - Pará" },
  { value: "TJPB", label: "TJPB - Paraíba" },
  { value: "TJPE", label: "TJPE - Pernambuco" },
  { value: "TJPI", label: "TJPI - Piauí" },
  { value: "TJPR", label: "TJPR - Paraná" },
  { value: "TJRJ", label: "TJRJ - Rio de Janeiro" },
  { value: "TJRN", label: "TJRN - Rio Grande do Norte" },
  { value: "TJRO", label: "TJRO - Rondônia" },
  { value: "TJRR", label: "TJRR - Roraima" },
  { value: "TJRS", label: "TJRS - Rio Grande do Sul" },
  { value: "TJSC", label: "TJSC - Santa Catarina" },
  { value: "TJSE", label: "TJSE - Sergipe" },
  { value: "TJSP", label: "TJSP - São Paulo" },
  { value: "TJTO", label: "TJTO - Tocantins" },
  // Federais
  { value: "TRF1", label: "TRF1 - 1ª Região" },
  { value: "TRF2", label: "TRF2 - 2ª Região" },
  { value: "TRF3", label: "TRF3 - 3ª Região" },
  { value: "TRF4", label: "TRF4 - 4ª Região" },
  { value: "TRF5", label: "TRF5 - 5ª Região" },
  { value: "TRF6", label: "TRF6 - 6ª Região" },
  // Trabalhistas
  { value: "TRT1", label: "TRT1 - Rio de Janeiro" },
  { value: "TRT2", label: "TRT2 - São Paulo" },
  { value: "TRT3", label: "TRT3 - Minas Gerais" },
  { value: "TRT4", label: "TRT4 - Rio Grande do Sul" },
  { value: "TRT5", label: "TRT5 - Bahia" },
  { value: "TRT6", label: "TRT6 - Pernambuco" },
  { value: "TRT7", label: "TRT7 - Ceará" },
  { value: "TRT8", label: "TRT8 - Pará/Amapá" },
  { value: "TRT9", label: "TRT9 - Paraná" },
  { value: "TRT10", label: "TRT10 - Distrito Federal/Tocantins" },
  { value: "TRT11", label: "TRT11 - Amazonas/Roraima" },
  { value: "TRT12", label: "TRT12 - Santa Catarina" },
  { value: "TRT13", label: "TRT13 - Paraíba" },
  { value: "TRT14", label: "TRT14 - Rondônia/Acre" },
  { value: "TRT15", label: "TRT15 - Campinas" },
  { value: "TRT16", label: "TRT16 - Maranhão" },
  { value: "TRT17", label: "TRT17 - Espírito Santo" },
  { value: "TRT18", label: "TRT18 - Goiás" },
  { value: "TRT19", label: "TRT19 - Alagoas" },
  { value: "TRT20", label: "TRT20 - Sergipe" },
  { value: "TRT21", label: "TRT21 - Rio Grande do Norte" },
  { value: "TRT22", label: "TRT22 - Piauí" },
  { value: "TRT23", label: "TRT23 - Mato Grosso" },
  { value: "TRT24", label: "TRT24 - Mato Grosso do Sul" },
];

export function CredencialDialog({ open, onOpenChange, credencial, onSave, saving }: CredencialDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    nome: "",
    sistema: "",
    tribunal: "",
    login: "",
    senha_hash: "",
    certificado_a1_path: "",
    certificado_a1_senha: "",
    qrcode_2fa_path: "",
    ativo: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const certInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  const handleCertificadoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validar extensão
    if (!file.name.toLowerCase().endsWith('.pfx') && !file.name.toLowerCase().endsWith('.p12')) {
      toast.error("Formato inválido. Selecione um arquivo .pfx ou .p12");
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5MB");
      return;
    }

    setUploadingCert(true);
    try {
      const fileName = `${user.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
      const { error } = await supabase.storage
        .from('cofre_certificados')
        .upload(fileName, file);

      if (error) throw error;

      setFormData({ ...formData, certificado_a1_path: fileName });
      toast.success("Certificado enviado com sucesso");
    } catch (err: any) {
      console.error("Erro ao enviar certificado:", err);
      toast.error("Erro ao enviar certificado: " + err.message);
    } finally {
      setUploadingCert(false);
    }
  };

  const handleQRCodeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validar extensão
    const validExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validExts.includes(ext)) {
      toast.error("Formato inválido. Selecione uma imagem PNG, JPG ou GIF");
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 2MB");
      return;
    }

    setUploadingQR(true);
    try {
      const fileName = `${user.id}/qrcode_${Date.now()}_${sanitizeFileName(file.name)}`;
      const { error } = await supabase.storage
        .from('cofre_certificados')
        .upload(fileName, file);

      if (error) throw error;

      setFormData({ ...formData, qrcode_2fa_path: fileName });
      toast.success("QR Code enviado com sucesso");
    } catch (err: any) {
      console.error("Erro ao enviar QR Code:", err);
      toast.error("Erro ao enviar QR Code: " + err.message);
    } finally {
      setUploadingQR(false);
    }
  };

  const removeCertificado = async () => {
    if (!formData.certificado_a1_path) return;
    
    try {
      await supabase.storage
        .from('cofre_certificados')
        .remove([formData.certificado_a1_path]);
      setFormData({ ...formData, certificado_a1_path: "" });
      toast.success("Certificado removido");
    } catch (err) {
      console.error("Erro ao remover certificado:", err);
    }
  };

  const removeQRCode = async () => {
    if (!formData.qrcode_2fa_path) return;
    
    try {
      await supabase.storage
        .from('cofre_certificados')
        .remove([formData.qrcode_2fa_path]);
      setFormData({ ...formData, qrcode_2fa_path: "" });
      toast.success("QR Code removido");
    } catch (err) {
      console.error("Erro ao remover QR Code:", err);
    }
  };

  useEffect(() => {
    if (credencial) {
      setFormData({
        nome: credencial.nome,
        sistema: credencial.sistema,
        tribunal: credencial.tribunal,
        login: credencial.login,
        senha_hash: "", // Não exibir senha existente
        certificado_a1_path: credencial.certificado_a1_path || "",
        certificado_a1_senha: "",
        qrcode_2fa_path: credencial.qrcode_2fa_path || "",
        ativo: credencial.ativo,
      });
      setAceitouTermos(true); // Já aceitou anteriormente
    } else {
      setFormData({
        nome: "",
        sistema: "",
        tribunal: "",
        login: "",
        senha_hash: "",
        certificado_a1_path: "",
        certificado_a1_senha: "",
        qrcode_2fa_path: "",
        ativo: true,
      });
      setAceitouTermos(false);
    }
  }, [credencial, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceitouTermos && !credencial) {
      return;
    }
    
    const dataToSave = { ...formData };
    // Se editando e senha vazia, não enviar senha
    if (credencial && !dataToSave.senha_hash) {
      delete (dataToSave as any).senha_hash;
    }
    if (credencial && !dataToSave.certificado_a1_senha) {
      delete (dataToSave as any).certificado_a1_senha;
    }
    
    onSave(dataToSave);
  };

  const isEditing = !!credencial;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Credencial" : "Nova Credencial no Cofre"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome identificador *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Minha senha PJe TJDFT"
                required
              />
            </div>

            <div>
              <Label>Sistema *</Label>
              <Select
                value={formData.sistema}
                onValueChange={(v) => setFormData({ ...formData, sistema: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {SISTEMAS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tribunal *</Label>
              <Select
                value={formData.tribunal}
                onValueChange={(v) => setFormData({ ...formData, tribunal: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {TRIBUNAIS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Login do Portal *</Label>
              <Input
                value={formData.login}
                onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                placeholder="CPF ou usuário"
                required
              />
            </div>

            <div>
              <Label>Senha do Portal {!isEditing && "*"}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={formData.senha_hash}
                  onChange={(e) => setFormData({ ...formData, senha_hash: e.target.value })}
                  placeholder={isEditing ? "Deixe vazio para manter" : "Sua senha"}
                  required={!isEditing}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <p className="text-sm font-medium">Autenticação adicional (opcional)</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Certificado A1</Label>
                <input
                  ref={certInputRef}
                  type="file"
                  accept=".pfx,.p12"
                  className="hidden"
                  onChange={handleCertificadoUpload}
                />
                {formData.certificado_a1_path ? (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200">
                    <FileKey className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700 dark:text-green-300 truncate flex-1">
                      {formData.certificado_a1_path.split('/').pop()}
                    </span>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={removeCertificado}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => certInputRef.current?.click()}
                    disabled={uploadingCert}
                  >
                    {uploadingCert ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Enviar .pfx ou .p12
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-1">Arquivo .pfx ou .p12 (máx. 5MB)</p>
              </div>

              <div>
                <Label>Senha do Certificado</Label>
                <Input
                  type="password"
                  value={formData.certificado_a1_senha}
                  onChange={(e) => setFormData({ ...formData, certificado_a1_senha: e.target.value })}
                  placeholder="Senha do A1"
                />
              </div>

              <div className="col-span-2">
                <Label>QR Code 2FA</Label>
                <input
                  ref={qrInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleQRCodeUpload}
                />
                {formData.qrcode_2fa_path ? (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200">
                    <span className="text-sm text-blue-700 dark:text-blue-300 truncate flex-1">
                      {formData.qrcode_2fa_path.split('/').pop()}
                    </span>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={removeQRCode}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => qrInputRef.current?.click()}
                    disabled={uploadingQR}
                  >
                    {uploadingQR ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Enviar imagem do QR Code
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-1">Para tribunais com 2FA obrigatório</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Credencial ativa</Label>
            <Switch
              checked={formData.ativo}
              onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
            />
          </div>

          {!isEditing && (
            <div className="border rounded-lg p-4 bg-amber-50 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="termos"
                  checked={aceitouTermos}
                  onCheckedChange={(v) => setAceitouTermos(v === true)}
                />
                <label htmlFor="termos" className="text-sm leading-relaxed">
                  Li e aceito os <strong>Termos de Uso do Cofre de Senhas</strong>. Declaro que sou titular 
                  das credenciais informadas e autorizo o sistema a utilizá-las para captura automática 
                  de intimações eletrônicas dos portais dos tribunais.
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || (!aceitouTermos && !isEditing)}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Atualizar" : "Salvar no Cofre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
