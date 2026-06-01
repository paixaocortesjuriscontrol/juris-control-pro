import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Save, X } from "lucide-react";
import {
  useConfiguracaoCargaBenner,
  useSalvarConfiguracaoCargaBenner,
} from "@/hooks/useConfiguracoesCargaBenner";

function parseEmails(s: string): string[] {
  return s.split(/[,;\n]/).map((e) => e.trim()).filter(Boolean);
}

export default function ConfiguracoesCargaBenner() {
  const { data: cfg, isLoading } = useConfiguracaoCargaBenner();
  const salvar = useSalvarConfiguracaoCargaBenner();

  const [para, setPara] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [paraInput, setParaInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");

  useEffect(() => {
    if (!cfg) return;
    setPara(cfg.email_padrao_para);
    setCc(cfg.email_padrao_cc);
    setAssunto(cfg.email_assunto_padrao);
    setCorpo(cfg.email_corpo_padrao);
  }, [cfg]);

  const addPara = () => {
    const novos = parseEmails(paraInput);
    if (novos.length) setPara((prev) => Array.from(new Set([...prev, ...novos])));
    setParaInput("");
  };
  const addCc = () => {
    const novos = parseEmails(ccInput);
    if (novos.length) setCc((prev) => Array.from(new Set([...prev, ...novos])));
    setCcInput("");
  };

  const onSalvar = () => {
    salvar.mutate({
      id: cfg?.id,
      coordenacao_id: null,
      email_padrao_para: para,
      email_padrao_cc: cc,
      email_assunto_padrao: assunto,
      email_corpo_padrao: corpo,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
        Carregando configurações...
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/remessas-benner">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Configurações de Remessas Benner</h1>
            <p className="text-sm text-muted-foreground">
              Destinatários e modelo padrão usados ao enviar remessas por e-mail
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Destinatários padrão</CardTitle>
          <CardDescription>
            Esses e-mails são pré-carregados ao enviar cada remessa. Você ainda
            pode ajustá-los no momento do envio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Para</Label>
            <div className="flex flex-wrap gap-1 min-h-[2rem]">
              {para.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhum e-mail cadastrado</span>
              )}
              {para.map((e) => (
                <Badge key={e} variant="secondary" className="gap-1">
                  {e}
                  <button
                    onClick={() => setPara((prev) => prev.filter((x) => x !== e))}
                    className="hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={paraInput}
                onChange={(e) => setParaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPara();
                  }
                }}
                placeholder="email@dominio.com (Enter para adicionar)"
              />
              <Button type="button" onClick={addPara} variant="outline">
                Adicionar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cópia (CC)</Label>
            <div className="flex flex-wrap gap-1 min-h-[2rem]">
              {cc.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhum e-mail cadastrado</span>
              )}
              {cc.map((e) => (
                <Badge key={e} variant="secondary" className="gap-1">
                  {e}
                  <button
                    onClick={() => setCc((prev) => prev.filter((x) => x !== e))}
                    className="hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCc();
                  }
                }}
                placeholder="email@dominio.com (Enter para adicionar)"
              />
              <Button type="button" onClick={addCc} variant="outline">
                Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modelo de e-mail</CardTitle>
          <CardDescription>
            Use <code className="text-xs bg-muted px-1 rounded">{"{numero}"}</code> e{" "}
            <code className="text-xs bg-muted px-1 rounded">{"{quantidade}"}</code> para inserir
            o número da remessa e a quantidade de dossiês.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Assunto padrão</Label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Corpo padrão</Label>
            <Textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={8} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={onSalvar} disabled={salvar.isPending}>
          {salvar.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}