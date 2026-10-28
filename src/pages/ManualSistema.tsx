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
    titulo: "Manual Completo do Juris Control (v9.7.1)",
    descricao:
      "Guia atualizado dos módulos, incluindo Atas, Pautas de Julgamento, migração Projuris, perfis, notificações e uso no celular.",
    arquivo: "/manuais/Manual_Juris_Control_v9.7.1.pdf",
  },
  {
    titulo: "Manual do Painel de Controle (v9.7.1)",
    descricao:
      "Guia completo de filtros, visões, criação e baixa de itens, recorrências, ações em lote, relatórios e exportação de audiências.",
    arquivo: "/manuais/Manual_Painel_de_Controle_v9.7.1.pdf",
  },
  {
    titulo: "Manual da Distribuição TST (v9.7.1)",
    descricao:
      "Guia de distribuições, filtros, matérias, pendências, Judit, delegação, Carga Benner, Admin. TST, arquivamento e auditoria.",
    arquivo: "/manuais/Manual_Distribuicao_TST_v9.7.1.pdf",
  },
  {
    titulo: "Manual de Termos DJEN (v9.7.1)",
    descricao:
      "Como cadastrar, monitorar e auditar termos, OABs e processos no monitoramento do DJEN.",
    arquivo: "/manuais/Manual_Termos_DJEN_v9.7.1.pdf",
  },
  {
    titulo: "Manual de Processos e Casos (v9.7.1)",
    descricao: "Cadastro, partes, Sistema Judicial, relatórios de cliente, Judit, documentos e atividades vinculadas.",
    arquivo: "/manuais/Manual_Processos_e_Casos_v9.7.1.pdf",
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
