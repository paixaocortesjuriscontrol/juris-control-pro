import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Play, PlugZap, Loader2, Info, FileKey, X } from "lucide-react";
import { format } from "date-fns";

const TRIBUNAIS = ["TST", ...Array.from({ length: 24 }, (_, i) => `TRT${i + 1}`)];
const fmt = (d?: string | null) => (d ? format(new Date(d), "dd/MM/yyyy HH:mm") : "—");

export default function CredenciaisPje() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [tribs, setTribs] = useState<string[]>([]);
  const [ativo, setAtivo] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certSenha, setCertSenha] = useState("");
  const [removerCert, setRemoverCert] = useState(false);

  const { data: cred } = useQuery({
    queryKey: ["cred-pje", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("credenciais_pje_usuario")
        .select("id, cpf, tribunais, ativo, ultimo_status, ultima_mensagem, ultima_execucao, certificado_nome")
        .eq("usuario_id", user!.id).maybeSingle();
      return data;
    },
  });
  const { data: hist = [] } = useQuery({
    queryKey: ["exec-pje", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("execucoes_pje_direto").select("*")
        .eq("usuario_id", user!.id).order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (cred) { setCpf(cred.cpf); setTribs(cred.tribunais ?? []); setAtivo(cred.ativo); }
  }, [JSON.stringify(cred)]);

  const chamar = async (acao: string, extra: Record<string, unknown> = {}) => {
    setBusy(acao);
    try {
      const { data, error } = await supabase.functions.invoke("buscar-pje-direto", { body: { acao, ...extra } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } finally {
      setBusy(null);
      await qc.invalidateQueries({ queryKey: ["cred-pje"] });
      await qc.invalidateQueries({ queryKey: ["exec-pje"] });
    }
  };

  const lerArquivoBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
      r.onerror = () => reject(new Error("Falha ao ler o arquivo"));
      r.readAsDataURL(f);
    });

  const salvar = async () => {
    try {
      const extra: Record<string, unknown> = {};
      if (removerCert) {
        extra.remover_certificado = true;
      } else if (certFile) {
        if (certFile.size > 3 * 1024 * 1024) throw new Error("Arquivo do certificado muito grande (máx. 3 MB)");
        extra.certificado_base64 = await lerArquivoBase64(certFile);
        extra.certificado_nome = certFile.name;
        extra.certificado_senha = certSenha;
      } else if (certSenha && cred?.certificado_nome) {
        extra.certificado_senha = certSenha;
      }
      await chamar("salvar", { cpf, senha, tribunais: tribs, ativo, ...extra });
      setSenha(""); setCertFile(null); setCertSenha(""); setRemoverCert(false);
      toast.success("Credencial salva");
    }
    catch (e: any) { toast.error(e.message); }
  };
  const testar = async () => {
    try {
      const d = await chamar("testar", { tribunal: tribs[0] });
      d.success ? toast.success(`Acesso OK no ${d.tribunal}: ${d.avisos} aviso(s) pendente(s)`) : toast.error(`${d.tribunal}: ${d.error}`);
    } catch (e: any) { toast.error(e.message); }
  };
  const buscar = async () => {
    try {
      const d = await chamar("buscar");
      const novos = (d.resultado ?? []).reduce((s: number, r: any) => s + (r.novos ?? 0), 0);
      toast.success(`Busca concluída: ${novos} publicação(ões) nova(s) na Análise DJEN`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <MainLayout title="Minhas credenciais PJe" subtitle="Busca as intimações direto no PJe, antes do DJEN, com os termos da sua coordenação">
      <div className="space-y-4 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acesso ao PJe</CardTitle>
            <CardDescription className="flex gap-2 items-start">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              A senha fica criptografada e ninguém consegue vê-la. Os avisos não são marcados como lidos no PJe, então o prazo não começa a contar por causa desta busca.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>CPF</Label><Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" /></div>
              <div><Label>Senha do PJe</Label><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={cred ? "Deixe em branco para manter" : ""} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Tribunais</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setTribs(TRIBUNAIS)}>Marcar todos</Button>
                  <Button size="sm" variant="ghost" onClick={() => setTribs([])}>Limpar</Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TRIBUNAIS.map((t) => (
                  <Badge key={t} variant={tribs.includes(t) ? "default" : "outline"} className="cursor-pointer"
                    onClick={() => setTribs((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}>{t}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={ativo} onCheckedChange={setAtivo} /><span className="text-sm">Incluir na busca automática (mesmos horários do DJEN Termos)</span></div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={salvar} disabled={!!busy}>{busy === "salvar" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
              <Button variant="outline" onClick={testar} disabled={!cred || !!busy}>{busy === "testar" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlugZap className="h-4 w-4 mr-2" />}Testar acesso ({tribs[0] ?? "—"})</Button>
              <Button variant="secondary" onClick={buscar} disabled={!cred || !!busy}>{busy === "buscar" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}Buscar agora</Button>
            </div>
            {cred && (
              <p className="text-sm text-muted-foreground">
                Última busca: {fmt(cred.ultima_execucao)} ·{" "}
                {cred.ultimo_status === "erro" ? <span className="text-destructive">Erro: {cred.ultima_mensagem}</span> : cred.ultimo_status === "ok" ? "OK" : "ainda não testada"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Histórico das buscas</CardTitle></CardHeader>
          <CardContent>
            {hist.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma busca ainda.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground border-b">
                    <th className="py-1.5">Data</th><th>Tribunal</th><th>Avisos</th><th>Batem com termos</th><th>Novos</th><th>Tipo</th><th>Erro</th></tr></thead>
                  <tbody>{hist.map((h: any) => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="py-1.5">{fmt(h.created_at)}</td><td>{h.tribunal}</td><td>{h.avisos_encontrados}</td>
                      <td>{h.avisos_filtrados}</td><td>{h.novos}</td><td>{h.origem === "agendada" ? "Automática" : "Manual"}</td>
                      <td className="text-destructive max-w-xs truncate" title={h.erro ?? ""}>{h.erro ?? ""}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
