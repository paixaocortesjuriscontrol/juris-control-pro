import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Pencil,
  Save,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import {
  usePecasGeradas,
  useGerarPecaJuridica,
  useMarcarPecaRevisada,
  useBuscarTesesAplicaveis,
  useSalvarConteudoPeca,
  useExcluirPeca,
  type TipoPeca,
} from "@/hooks/useTesesJuridicas";

const TIPOS_PECA: { value: TipoPeca; label: string }[] = [
  { value: "contestacao", label: "Contestação" },
  { value: "recurso_ordinario", label: "Recurso Ordinário" },
  { value: "contrarrazoes", label: "Contrarrazões" },
  { value: "peticao_inicial", label: "Petição Inicial" },
  { value: "memoriais", label: "Memoriais" },
  { value: "outros", label: "Outros" },
];

function rotuloTipo(tipo: string) {
  return TIPOS_PECA.find((t) => t.value === tipo)?.label ?? tipo;
}

function dataBR(valor?: string | null) {
  if (!valor) return "";
  return new Date(valor).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

async function exportarDocx(peca: any) {
  const paragrafos = String(peca.conteudo ?? "")
    .split("\n")
    .map(
      (linha) =>
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160, line: 360 },
          children: [new TextRun({ text: linha, font: "Times New Roman", size: 24 })],
        }),
    );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
            children: [
              new TextRun({
                text: rotuloTipo(peca.tipo_peca).toUpperCase(),
                bold: true,
                font: "Times New Roman",
                size: 26,
              }),
            ],
          }),
          ...paragrafos,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `peca-${peca.tipo_peca}-${new Date(peca.created_at).toISOString().slice(0, 10)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function GerarPecaTab({ processoId }: { processoId: string }) {
  const [tipoPeca, setTipoPeca] = useState<TipoPeca>("contestacao");
  const [teseId, setTeseId] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [showObservacoes, setShowObservacoes] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState("");

  const { data: pecas = [], isLoading: loadingPecas } = usePecasGeradas(processoId);
  const { data: tesesAplicaveis = [], isLoading: loadingTeses } = useBuscarTesesAplicaveis(processoId, tipoPeca);
  const gerar = useGerarPecaJuridica();
  const marcarRevisada = useMarcarPecaRevisada();
  const salvarConteudo = useSalvarConteudoPeca();
  const excluirPeca = useExcluirPeca();

  async function handleGerar() {
    await gerar.mutateAsync({
      processoId,
      tipoPeca,
      teseId: teseId && teseId !== "__auto__" ? teseId : null,
      observacoes: observacoes.trim() || null,
    });
    setObservacoes("");
    setShowObservacoes(false);
  }

  async function handleExportar(peca: any) {
    if (!peca.revisado) {
      toast.error("Só é possível exportar depois da revisão humana. Marque a peça como revisada.");
      return;
    }
    await exportarDocx(peca);
  }

  async function handleSalvarEdicao(peca: any) {
    await salvarConteudo.mutateAsync({ id: peca.id, conteudo: textoEdicao });
    setEditandoId(null);
    setTextoEdicao("");
  }

  return (
    <div className="space-y-4">
      {/* Gerador */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            Gerar Peça Jurídica com IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tipo de peça</label>
              <Select value={tipoPeca} onValueChange={(v) => setTipoPeca(v as TipoPeca)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_PECA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tese aplicável</label>
              <Select value={teseId || "__auto__"} onValueChange={setTeseId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Busca automática</SelectItem>
                  {tesesAplicaveis.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.titulo} (score: {t.score})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingTeses && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Buscando teses aplicáveis...
            </p>
          )}

          {!loadingTeses && tesesAplicaveis.length === 0 && (
            <p className="text-xs text-amber-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Nenhuma tese encontrada no banco. A peça será gerada sem tese específica.
            </p>
          )}

          {showObservacoes && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Observações para a IA</label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Focar no argumento de prescrição."
                className="min-h-[80px]"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={handleGerar} disabled={gerar.isPending}>
              {gerar.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-1" /> Gerar peça</>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowObservacoes(!showObservacoes)}>
              {showObservacoes ? "Ocultar observações" : "Adicionar observações"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Toda peça nasce como rascunho e só pode ser exportada depois da revisão humana.
          </p>

          {gerar.data?.tese_usada && (
            <p className="text-xs text-muted-foreground">
              Tese utilizada: <span className="font-medium">{gerar.data.tese_usada.titulo}</span>
              {" "}· Modelo: {gerar.data.modelo} · {gerar.data.tokens?.total} tokens · ${(gerar.data.custo_usd ?? 0).toFixed(4)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Peças geradas */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Peças Geradas ({pecas.length})
        </h3>

        {loadingPecas ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : pecas.length === 0 ? (
          <Card><CardContent className="py-8 text-center">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma peça gerada ainda.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {pecas.map((peca: any) => {
              const emEdicao = editandoId === peca.id;
              return (
                <Card key={peca.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{rotuloTipo(peca.tipo_peca)}</Badge>
                        {peca.revisado ? (
                          <Badge className="text-xs bg-emerald-600">
                            <CheckCircle2 className="h-3 w-3 mr-0.5" /> Revisada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-600">Rascunho</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{dataBR(peca.created_at)}</span>
                      </div>
                      <div className="flex gap-1">
                        {emEdicao ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSalvarEdicao(peca)}
                              disabled={salvarConteudo.isPending}
                            >
                              <Save className="h-4 w-4 mr-1" /> Salvar
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setEditandoId(null); setTextoEdicao(""); }}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setEditandoId(peca.id); setTextoEdicao(peca.conteudo ?? ""); }}
                            >
                              <Pencil className="h-4 w-4 mr-1" /> Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => marcarRevisada.mutate({ id: peca.id, revisado: !peca.revisado })}
                            >
                              {peca.revisado ? "Desfazer revisão" : "Marcar como revisada"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExportar(peca)}
                              title={peca.revisado ? "Exportar .docx" : "Disponível após a revisão"}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => {
                                if (confirm("Excluir esta peça?")) excluirPeca.mutate(peca.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {peca.observacoes && (
                      <p className="text-xs text-muted-foreground mb-2 italic">Obs: {peca.observacoes}</p>
                    )}
                    {emEdicao ? (
                      <Textarea
                        value={textoEdicao}
                        onChange={(e) => setTextoEdicao(e.target.value)}
                        className="min-h-[400px] font-mono text-sm"
                      />
                    ) : (
                      <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded max-h-96 overflow-y-auto">
                        {peca.conteudo}
                      </pre>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Modelo: {peca.modelo_ia} · Custo: ${(peca.custo_usd ?? 0).toFixed(4)} ·{" "}
                      {(peca.tokens_input ?? 0) + (peca.tokens_output ?? 0)} tokens
                      {peca.revisado && peca.revisado_em ? ` · Revisada em ${dataBR(peca.revisado_em)}` : ""}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
