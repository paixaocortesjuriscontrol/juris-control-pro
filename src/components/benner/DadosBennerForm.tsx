import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Search, Save, ArrowLeft, Loader2 } from "lucide-react";
import { DadoBenner, DadoBennerInsert } from "@/hooks/useDadosBenner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  dado?: DadoBenner | null;
  onSave: (dado: DadoBennerInsert, id?: string) => Promise<boolean>;
  onCancel: () => void;
}

const emptyForm: DadoBennerInsert = {
  user_id: null, coordenacao_id: null, status: "rascunho",
  dossie: "", contrato: "", tribunal: "", tipo_recurso: "", data_distribuicao: null,
  turma: "", relator: "", analise_quarteirizado: "", risco_midia: "",
  risco_descricao: "", provas_digitais: "", tem_data_julgamento: "",
  data_julgamento: null, horario_julgamento: "", tipo_julgamento: "",
  materia_honra: "", entrega_memoriais: "", sustentacao_oral: "",
  resultado_sem_transcendencia: false, resultado_nao_conhecido: false,
  resultado_conhecido_provido: false, resultado_conhecido_nao_provido: false,
  resultado_outra: "", observacoes: "", ganhamos: false, perdemos: false,
  processo_baixado: "", recorrente: "",
  posicao_turma_favoravel: false, posicao_turma_desfavoravel: false,
  posicao_relator_favoravel: false, posicao_relator_desfavoravel: false,
  recurso_bem_aparelhado: false, recurso_mal_aparelhado: false,
  chance_exito: "",
};

export function DadosBennerForm({ dado, onSave, onCancel }: Props) {
  const [form, setForm] = useState<DadoBennerInsert>({ ...emptyForm });
  const [prontoEnviar, setProntoEnviar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState<any[]>([]);

  useEffect(() => {
    if (dado) {
      const { id, created_at, updated_at, ...rest } = dado;
      setForm(rest as DadoBennerInsert);
      setProntoEnviar(dado.status === "pronto_envio");
    } else {
      // Set user_id
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) setForm(f => ({ ...f, user_id: data.user!.id }));
      });
    }
  }, [dado]);

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const handleBuscarContrato = async () => {
    if (!form.contrato?.trim()) { toast.warning("Digite o número do processo"); return; }
    setBuscando(true);
    
    // Busca na tabela distribuicoes_tst pelo número do processo para obter dossiê
    const { data: distTst } = await supabase
      .from("distribuicoes_tst" as any)
      .select("processo_numero, dossie, turma, relator, equipe, relator_favorabilidade, turma_favorabilidade")
      .ilike("processo_numero" as any, `%${form.contrato}%`)
      .limit(5);

    // Busca na própria tabela dados_benner
    const { data: dadosBenner } = await supabase
      .from("dados_benner" as any)
      .select("dossie, contrato, turma, relator, tribunal, coordenacao_id")
      .ilike("contrato" as any, `%${form.contrato}%`)
      .limit(5);
    
    // Busca na tabela processos
    const { data: processos } = await supabase
      .from("processos")
      .select("id, numero, dossie_tst, turma_tst, relator_tst, coordenacao_id")
      .or(`numero.ilike.%${form.contrato}%,dossie_tst.ilike.%${form.contrato}%`)
      .limit(5);
    
    setBuscando(false);
    
    const resultados: any[] = [];
    if (distTst && (distTst as any[]).length > 0) {
      (distTst as any[]).forEach((d: any) => {
        resultados.push({ tipo: "distribuicao", processo: d.processo_numero, dossie: d.dossie, turma: d.turma, relator: d.relator });
      });
    }
    if (dadosBenner && (dadosBenner as any[]).length > 0) {
      (dadosBenner as any[]).forEach((d: any) => {
        resultados.push({ tipo: "benner", contrato: d.contrato, dossie: d.dossie, turma: d.turma, relator: d.relator, tribunal: d.tribunal, coordenacao_id: d.coordenacao_id });
      });
    }
    if (processos && processos.length > 0) {
      processos.forEach((p: any) => {
        resultados.push({ tipo: "processo", id: p.id, numero: p.numero, dossie: p.dossie_tst, turma: p.turma_tst, relator: p.relator_tst, coordenacao_id: p.coordenacao_id });
      });
    }
    
    if (!resultados.length) { toast.info("Nenhum registro encontrado para este número de processo"); return; }
    setResultadosBusca(resultados);
  };

  const selecionarResultado = (res: any) => {
    setForm(f => ({
      ...f,
      dossie: res.dossie || f.dossie,
      turma: res.turma || f.turma,
      relator: res.relator || f.relator,
      coordenacao_id: res.coordenacao_id || f.coordenacao_id,
      tribunal: res.tribunal || f.tribunal,
    }));
    setResultadosBusca([]);
    toast.success("Dados preenchidos automaticamente!");
  };

  const handleSave = async () => {
    setSaving(true);
    const statusFinal = prontoEnviar ? "pronto_envio" : "rascunho";
    const toSave = { ...form, status: dado?.status === "planilhado" || dado?.status === "enviado" ? dado.status : statusFinal };
    const ok = await onSave(toSave, dado?.id);
    setSaving(false);
    if (ok) onCancel();
  };

  const SectionHeader = ({ title, color }: { title: string; color: string }) => (
    <div className={cn("px-4 py-2 rounded-t-lg font-semibold text-sm", color)}>
      {title}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft className="w-5 h-5" /></Button>
        <h2 className="text-xl font-bold text-foreground">{dado ? "Editar Registro" : "Novo Registro"}</h2>
      </div>

      {/* SEÇÃO RECURSO - Azul */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso (Colunas A-Q)" color="bg-blue-600 text-white" />
        <div className="p-4 space-y-4">
          {/* Número do Processo + Buscar */}
          <div className="space-y-2">
            <Label>Número do Processo</Label>
            <div className="flex gap-2">
              <Input value={form.contrato || ""} onChange={e => set("contrato", e.target.value)} placeholder="Número do processo" className="flex-1" />
              <Button variant="outline" onClick={handleBuscarContrato} disabled={buscando}>
                {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </Button>
            </div>
            {resultadosBusca.length > 0 && (
              <div className="border border-border rounded-md p-2 space-y-1 bg-muted/50">
                <p className="text-xs text-muted-foreground font-medium">Resultados encontrados:</p>
                {resultadosBusca.map((r, i) => (
                  <button key={i} onClick={() => selecionarResultado(r)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-accent text-sm">
                    {r.tipo === "distribuicao" ? (
                      <>
                        <span className="font-medium">{r.processo}</span>
                        {r.dossie && <span className="text-muted-foreground"> - Dossiê: {r.dossie}</span>}
                        <Badge variant="outline" className="ml-2 text-xs">Distribuição TST</Badge>
                      </>
                    ) : r.tipo === "benner" ? (
                      <>
                        <span className="font-medium">Processo: {r.contrato}</span>
                        {r.dossie && <span className="text-muted-foreground"> - Dossiê: {r.dossie}</span>}
                        <Badge variant="outline" className="ml-2 text-xs">Dados Benner</Badge>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{r.numero}</span>
                        {r.dossie && <span className="text-muted-foreground"> - Dossiê: {r.dossie}</span>}
                        <Badge variant="outline" className="ml-2 text-xs">Processos</Badge>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dossiê */}
          <div className="space-y-2">
            <Label>Dossiê (A)</Label>
            <Input value={form.dossie || ""} onChange={e => set("dossie", e.target.value)} placeholder="Número do dossiê" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tribunal (B)</Label>
              <Select value={form.tribunal || ""} onValueChange={v => set("tribunal", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TST">TST</SelectItem>
                  <SelectItem value="STF">STF</SelectItem>
                  <SelectItem value="STJ">STJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Tipo Recurso (C) */}
            <div className="space-y-2">
              <Label>Tipo de Recurso (C)</Label>
              <Input value={form.tipo_recurso || ""} onChange={e => set("tipo_recurso", e.target.value)} />
            </div>
            {/* Data Distribuição (D) */}
            <div className="space-y-2">
              <Label>Data Distribuição (D)</Label>
              <Input type="date" value={form.data_distribuicao || ""} onChange={e => set("data_distribuicao", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Turma (E)</Label>
              <Input value={form.turma || ""} onChange={e => set("turma", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Relator (F)</Label>
              <Input value={form.relator || ""} onChange={e => set("relator", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Análise Quarteirizado (G)</Label>
              <Input value={form.analise_quarteirizado || ""} onChange={e => set("analise_quarteirizado", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Risco Mídia Negativa (H)</Label>
              <Select value={form.risco_midia || ""} onValueChange={v => set("risco_midia", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Risco (I)</Label>
              <Input value={form.risco_descricao || ""} onChange={e => set("risco_descricao", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Provas Digitais (J)</Label>
              <Select value={form.provas_digitais || ""} onValueChange={v => set("provas_digitais", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Data Julgamento? (K)</Label>
              <Select value={form.tem_data_julgamento || ""} onValueChange={v => set("tem_data_julgamento", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data Julgamento (L)</Label>
              <Input type="date" value={form.data_julgamento || ""} onChange={e => set("data_julgamento", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Horário (M)</Label>
              <Input type="time" value={form.horario_julgamento || ""} onChange={e => set("horario_julgamento", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo Julgamento (N)</Label>
              <Select value={form.tipo_julgamento || ""} onValueChange={v => set("tipo_julgamento", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Virtual">Virtual</SelectItem>
                  <SelectItem value="Telepresencial">Telepresencial</SelectItem>
                  <SelectItem value="Híbrido">Híbrido</SelectItem>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Matéria de Honra (O)</Label>
              <Select value={form.materia_honra || ""} onValueChange={v => set("materia_honra", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entrega Memoriais (P)</Label>
              <Select value={form.entrega_memoriais || ""} onValueChange={v => set("entrega_memoriais", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sustentação Oral (Q)</Label>
              <Select value={form.sustentacao_oral || ""} onValueChange={v => set("sustentacao_oral", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                  <SelectItem value="Não cabe">Não cabe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO RESULTADO - Verde */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Resultado (Colunas R-W)" color="bg-green-600 text-white" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              ["resultado_sem_transcendencia", "Sem Transcendência (R)"],
              ["resultado_nao_conhecido", "Não Conhecido (S)"],
              ["resultado_conhecido_provido", "Conhecido e Provido (T)"],
              ["resultado_conhecido_nao_provido", "Conhecido e Não Provido (U)"],
            ] as const).map(([field, label]) => (
              <div key={field} className="flex items-center gap-2">
                <Checkbox checked={!!form[field]} onCheckedChange={v => set(field, !!v)} id={field} />
                <Label htmlFor={field} className="text-sm cursor-pointer">{label}</Label>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Outra (V)</Label>
            <Input value={form.resultado_outra || ""} onChange={e => set("resultado_outra", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observações (W)</Label>
            <Textarea value={form.observacoes || ""} onChange={e => set("observacoes", e.target.value)} rows={3} />
          </div>
        </div>
      </div>

      {/* SEÇÃO RESUMO - Amarelo */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Resumo (Colunas X-AA)" color="bg-yellow-500 text-black" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.ganhamos} onCheckedChange={v => set("ganhamos", !!v)} id="ganhamos" />
              <Label htmlFor="ganhamos" className="cursor-pointer">Ganhamos (X)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.perdemos} onCheckedChange={v => set("perdemos", !!v)} id="perdemos" />
              <Label htmlFor="perdemos" className="cursor-pointer">Perdemos (Y)</Label>
            </div>
            <div className="space-y-2">
              <Label>Processo Baixado (Z)</Label>
              <Select value={form.processo_baixado || ""} onValueChange={v => set("processo_baixado", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recorrente (AA)</Label>
              <Input value={form.recorrente || ""} onChange={e => set("recorrente", e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO POSICIONAMENTO TURMA - Laranja */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Posicionamento Turma (AB-AC)" color="bg-orange-500 text-white" />
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.posicao_turma_favoravel} onCheckedChange={v => set("posicao_turma_favoravel", !!v)} id="ptf" />
              <Label htmlFor="ptf" className="cursor-pointer">Favorável (AB)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.posicao_turma_desfavoravel} onCheckedChange={v => set("posicao_turma_desfavoravel", !!v)} id="ptd" />
              <Label htmlFor="ptd" className="cursor-pointer">Desfavorável (AC)</Label>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO POSICIONAMENTO RELATOR - Rosa */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Posicionamento Relator (AD-AE)" color="bg-pink-500 text-white" />
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.posicao_relator_favoravel} onCheckedChange={v => set("posicao_relator_favoravel", !!v)} id="prf" />
              <Label htmlFor="prf" className="cursor-pointer">Favorável (AD)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.posicao_relator_desfavoravel} onCheckedChange={v => set("posicao_relator_desfavoravel", !!v)} id="prd" />
              <Label htmlFor="prd" className="cursor-pointer">Desfavorável (AE)</Label>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO RECURSO/CHANCE - Roxo */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso / Chance de Êxito (AF-AH)" color="bg-purple-600 text-white" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.recurso_bem_aparelhado} onCheckedChange={v => set("recurso_bem_aparelhado", !!v)} id="rba" />
              <Label htmlFor="rba" className="cursor-pointer">Bem Aparelhado (AF)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.recurso_mal_aparelhado} onCheckedChange={v => set("recurso_mal_aparelhado", !!v)} id="rma" />
              <Label htmlFor="rma" className="cursor-pointer">Mal Aparelhado (AG)</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Chance de Êxito (AH)</Label>
            <Select value={form.chance_exito || ""} onValueChange={v => set("chance_exito", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Possível">Possível</SelectItem>
                <SelectItem value="Provável">Provável</SelectItem>
                <SelectItem value="Remota">Remota</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <Switch checked={prontoEnviar} onCheckedChange={setProntoEnviar}
            disabled={dado?.status === "planilhado" || dado?.status === "enviado"} />
          <Label className="text-sm font-medium">Pronto para Enviar</Label>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
