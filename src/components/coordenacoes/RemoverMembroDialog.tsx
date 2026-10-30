import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Membro { id: string; usuario_id?: string; usuario?: { id: string; nome: string } | null }

interface Props {
  membro: Membro | null;
  coordenacaoId: string;
  membros: Membro[];
  onClose: () => void;
}

type Contagem = Record<string, number>;

export function RemoverMembroDialog({ membro, coordenacaoId, membros, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const usuarioId = membro?.usuario?.id || membro?.usuario_id || null;
  const [contagem, setContagem] = useState<Contagem | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [limpar, setLimpar] = useState(true);
  const [substituto, setSubstituto] = useState<string>("nenhum");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setContagem(null); setLimpar(true); setSubstituto("nenhum");
    if (!membro || !usuarioId) return;
    setCarregando(true);
    supabase.rpc("contar_vinculos_usuario_coordenacao" as any, { _usuario: usuarioId, _coordenacao_id: coordenacaoId })
      .then(({ data, error }) => {
        if (!error) setContagem(data as any);
        setCarregando(false);
      });
  }, [membro?.id, usuarioId, coordenacaoId]);

  const outros = membros.filter((m) => (m.usuario?.id || m.usuario_id) && (m.usuario?.id || m.usuario_id) !== usuarioId);
  const total = contagem ? Object.values(contagem).reduce((a, b) => a + Number(b || 0), 0) : 0;

  const confirmar = async () => {
    if (!membro) return;
    setSalvando(true);
    try {
      let resumo = "";
      if (limpar && usuarioId && total > 0) {
        const { data, error } = await supabase.rpc("desvincular_usuario_coordenacao" as any, {
          _usuario: usuarioId, _coordenacao_id: coordenacaoId, _substituto: substituto === "nenhum" ? null : substituto,
        });
        if (error) throw error;
        const r = data as any;
        const sem = (r?.sem_responsavel || []).length;
        resumo = `${r?.tarefas ?? 0} tarefa(s) ajustadas` + (sem ? `; ${sem} ficaram sem outro responsável e precisam ser redistribuídas` : "");
      }
      const { data: del, error } = await supabase.from("membros_coordenacao").delete().eq("id", membro.id).select("id");
      if (error) throw error;
      if (!del || del.length === 0) throw new Error("Sem permissão para remover este membro.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] }),
        queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] }),
        queryClient.invalidateQueries({ queryKey: ["tarefas"] }),
        queryClient.invalidateQueries({ queryKey: ["workflows"] }),
      ]);
      toast({ title: "Membro removido da equipe", description: resumo || undefined });
      onClose();
    } catch (e: any) {
      toast({ title: "Erro ao remover membro", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const linha = (rotulo: string, chave: string) => (
    <li className="flex justify-between"><span>{rotulo}</span><strong>{contagem?.[chave] ?? 0}</strong></li>
  );

  return (
    <Dialog open={!!membro} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remover {membro?.usuario?.nome || "membro"} da equipe?</DialogTitle>
          <DialogDescription>Itens em aberto desta coordenação ligados a essa pessoa. Itens concluídos e outras coordenações não mudam.</DialogDescription>
        </DialogHeader>
        {carregando ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Contando...</div>
        ) : contagem ? (
          <ul className="space-y-1 text-sm">
            {linha("Tarefas em aberto como responsável", "tarefas_responsavel")}
            {linha("…dessas, só ela/ele como responsável", "tarefas_sozinha")}
            {linha("Tarefas como envolvido(a)", "tarefas_envolvida")}
            {linha("Eventos", "eventos")}
            {linha("Audiências", "audiencias")}
            {linha("Etapas de workflow", "etapas_workflow")}
            {linha("Responsáveis fixos por tipo", "responsaveis_fixos")}
          </ul>
        ) : null}
        {total > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="limpar" checked={limpar} onCheckedChange={(v) => setLimpar(!!v)} />
              <Label htmlFor="limpar">Retirar também das tarefas e workflows</Label>
            </div>
            {limpar && (
              <div className="space-y-1">
                <Label>Substituto (opcional)</Label>
                <Select value={substituto} onValueChange={setSubstituto}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem substituto</SelectItem>
                    {outros.map((m) => {
                      const id = (m.usuario?.id || m.usuario_id)!;
                      return <SelectItem key={id} value={id}>{m.usuario?.nome || id}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmar} disabled={salvando || carregando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
