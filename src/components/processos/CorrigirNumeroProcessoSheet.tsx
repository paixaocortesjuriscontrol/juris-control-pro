import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { mascararCnjDigitacao, obterVariantesCnjBusca } from "@/utils/cnjMask";
import { cnjValido } from "@/lib/podeCorrigirNumeroProcesso";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  processoId: string;
  numeroAtual: string;
  coordenacaoId?: string | null;
  onSalvo?: (novo: string) => void;
}

export function CorrigirNumeroProcessoSheet({ open, onOpenChange, processoId, numeroAtual, coordenacaoId, onSalvo }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [novo, setNovo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [duplicado, setDuplicado] = useState<string | null>(null);
  const [formatoCnj, setFormatoCnj] = useState(true);

  useEffect(() => { if (open) { setNovo(""); setMotivo(""); setDuplicado(null); setFormatoCnj(true); } }, [open]);

  const digitos = novo.replace(/\D/g, "");
  const avisoDv = formatoCnj && digitos.length === 20 && !cnjValido(novo);
  // Só é "igual" se o texto for idêntico: trocar o formato/tipo do número com os mesmos dígitos é permitido.
  const igual = !!novo.trim() && novo.trim() === numeroAtual.trim();
  const podeSalvar = digitos.length >= 5 && !igual && motivo.trim().length >= 3 && !salvando;

  const salvar = async () => {
    setSalvando(true); setDuplicado(null);
    try {
      const { data: ex, error: e1 } = await supabase.from("processos").select("id, numero")
        .in("numero", obterVariantesCnjBusca(novo)).neq("id", processoId).limit(1);
      if (e1) throw e1;
      if (ex && ex.length) { setDuplicado(ex[0].numero); return; }
      const { data, error } = await supabase.from("processos").update({ numero: novo.trim() } as any)
        .eq("id", processoId).select("id, numero");
      if (error) {
        if ((error as any).code === "23505") { setDuplicado(novo); return; }
        throw error;
      }
      if (!data || !data.length) throw new Error("Você não tem permissão para alterar este processo.");
      await supabase.from("auditoria_tarefas").insert({
        usuario_id: user?.id, acao: "corrigir_numero", sucesso: true, origem: "corrigir_numero_processo",
        processo_id: processoId, tipo_item: "processo", coordenacao_id: coordenacaoId ?? null,
        campos_alterados: [{ campo: "numero", de: numeroAtual, para: data[0].numero, motivo: motivo.trim() }],
      } as any);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["processo"] }),
        qc.invalidateQueries({ queryKey: ["processos"] }),
      ]);
      onSalvo?.(data[0].numero);
      toast.success("Número do processo corrigido");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Não foi possível corrigir: " + (e?.message || e));
    } finally { setSalvando(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Corrigir número do processo</SheetTitle>
          <SheetDescription>Use quando o número foi cadastrado errado. Tarefas, prazos, audiências e documentos continuam ligados ao processo.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div>
            <Label>Número atual</Label>
            <Input value={numeroAtual} readOnly className="font-mono bg-muted" />
          </div>
          <div>
            <Label>Novo número *</Label>
            <Input value={novo} onChange={(e) => { setNovo(formatoCnj ? mascararCnjDigitacao(e.target.value) : e.target.value); setDuplicado(null); }}
              placeholder={formatoCnj ? "0000000-00.0000.0.00.0000" : "Digite o número no formato desejado"} className="font-mono" autoFocus />
            <label className="flex items-center gap-2 text-xs text-muted-foreground mt-2 cursor-pointer">
              <input type="checkbox" checked={!formatoCnj} onChange={(e) => { setFormatoCnj(!e.target.checked); setNovo(""); }} />
              Número fora do padrão CNJ (procedimento do MPT, inquérito, administrativo etc.)
            </label>
            {igual && <p className="text-xs text-muted-foreground mt-1">É o mesmo número atual.</p>}
            {avisoDv && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> O dígito verificador não confere. Confira o número; ainda é possível salvar.
              </p>
            )}
            {duplicado && (
              <p className="text-xs text-destructive mt-1">Já existe outro processo com o número {duplicado}. A correção não foi salva.</p>
            )}
          </div>
          <div>
            <Label>Motivo da correção *</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: dígitos invertidos no cadastro" rows={3} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!podeSalvar}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar correção
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
