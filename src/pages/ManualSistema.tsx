import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Download, ExternalLink } from "lucide-react";

type Manual = {
  titulo: string;
  descricao: string;
  arquivo: string;
};

const manuais: Manual[] = [
  {
    titulo: "Manual Completo do Juris Control (v4.2.9)",
    descricao:
      "Guia institucional completo: Painel de Controle, Processos e Casos, Análise DJEN, Termos DJEN e Coordenações, com perfis de acesso e fluxos de trabalho.",
    arquivo: "/manuais/Manual_Juris_Control_v4.2.9.pdf",
  },
  {
    titulo: "Manual de Termos DJEN",
    descricao:
      "Como cadastrar, monitorar e auditar termos, OABs e processos no monitoramento do DJEN.",
    arquivo: "/manuais/Manual_Termos_DJEN.pdf",
  },
];

export default function ManualSistema() {
  return (
    <MainLayout
      title="Manual Sistema"
      subtitle="Documentação oficial do Juris Control — Paixão Cortes Advogados"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {manuais.map((m) => (
          <Card key={m.arquivo} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base leading-snug">{m.titulo}</CardTitle>
                  <CardDescription className="mt-1">{m.descricao}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="mt-auto flex gap-2">
              <Button asChild variant="default" size="sm">
                <a href={m.arquivo} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={m.arquivo} download>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </MainLayout>
  );
}
