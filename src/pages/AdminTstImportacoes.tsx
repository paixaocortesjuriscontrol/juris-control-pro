import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CertidaoPdfImport } from "@/components/distribuicao-tst/CertidaoPdfImport";
import { DistribuicaoTstImport } from "@/components/distribuicao-tst/DistribuicaoTstImport";
import { DossieUpdateImport } from "@/components/distribuicao-tst/DossieUpdateImport";
import { EquipeUpdateImport } from "@/components/distribuicao-tst/EquipeUpdateImport";
import { SituacaoEnvioUpdateImport } from "@/components/distribuicao-tst/SituacaoEnvioUpdateImport";
import { RespostaSantanderImport } from "@/components/distribuicao-tst/RespostaSantanderImport";
import { BennerSimImport } from "@/components/distribuicao-tst/BennerSimImport";
import { useUserRole } from "@/hooks/useUserRole";
import { VoltarAdminTstButton } from "@/components/admin-tst/VoltarAdminTstButton";

type Coluna = { col: string; nome: string; exemplo?: string; obs?: string };

function LayoutPlanilha({ colunas }: { colunas: Coluna[] }) {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-20">Coluna</TableHead>
            <TableHead>Cabeçalho esperado</TableHead>
            <TableHead>Exemplo</TableHead>
            <TableHead>Observação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {colunas.map((c) => (
            <TableRow key={c.col}>
              <TableCell className="font-mono font-semibold">{c.col}</TableCell>
              <TableCell>{c.nome}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{c.exemplo ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{c.obs ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface SecaoProps {
  titulo: string;
  descricao: string;
  comoUsar: string[];
  layout?: Coluna[];
  layoutNota?: string;
  acao: React.ReactNode;
}

function Secao({ titulo, descricao, comoUsar, layout, layoutNota, acao }: SecaoProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-lg">{titulo}</CardTitle>
            <CardDescription className="mt-1">{descricao}</CardDescription>
          </div>
          <div className="flex-shrink-0">{acao}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold mb-2">Como usar</h4>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
            {comoUsar.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
        </div>
        {layout && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Layout da planilha</h4>
            <LayoutPlanilha colunas={layout} />
            {layoutNota && <p className="text-xs text-muted-foreground mt-2">{layoutNota}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminTstImportacoes() {
  const { isAdmin } = useUserRole();
  const refresh = () => { /* sem lista nesta tela; o refresh ocorre ao voltar para Distribuição TST */ };

  return (
    <MainLayout title="Importações — Distribuição TST">
      <div className="p-4 lg:p-6 space-y-6 max-w-6xl">
        <VoltarAdminTstButton />
        <div>
          <h2 className="text-xl font-semibold">Importações da Distribuição TST</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ferramentas de carga e atualização em massa. Cada cartão descreve o
            propósito, o passo a passo e o layout esperado da planilha (ou PDF).
          </p>
        </div>

        <Secao
          titulo="Importar PDF Certidão de Distribuição"
          descricao="Cadastra novos processos a partir do PDF da Certidão de Distribuição do TST. Caso o processo já exista na base de dados, a data de distribuição será atualizada."
          comoUsar={[
            "Clique no botão ao lado e selecione o PDF da Certidão.",
            "O sistema lê cada linha do PDF (número CNJ + data) e cadastra os processos faltantes.",
            "Processos já existentes têm a data de distribuição atualizada, com registro do comentário no card.",
          ]}
          layoutNota="Entrada em PDF (não é planilha). Cada linha do PDF deve conter o número CNJ no formato 0000000-00.0000.0.00.0000 seguido da data DD/MM/AAAA. Tolerante a quebras de espaço (ex.: '0000092 - 91 . 2024 . 5 . 09 . 0088')."
          acao={<CertidaoPdfImport onImported={refresh} />}
        />

        <Secao
          titulo="Importar Planilha (Distribuição TST)"
          descricao="Importação principal da planilha de distribuição. Lê todas as abas do arquivo e injeta a aba de origem em cada linha."
          comoUsar={[
            "Selecione o arquivo .xlsx da distribuição.",
            "Cada aba é lida automaticamente; a aba de origem fica registrada em cada processo.",
            "Processos duplicados (mesmo dossiê/processo) são consolidados conforme regra padrão.",
            "Ao final, baixe a planilha de duplicados (se houver) para conferência.",
          ]}
          layout={[
            { col: "A", nome: "Processo", exemplo: "0000123-45.2024.5.10.0001" },
            { col: "B", nome: "Dossiê", exemplo: "12345/2024", obs: "Chave de deduplicação" },
            { col: "—", nome: "Demais colunas conforme planilha padrão TST", obs: "Cabeçalho é detectado automaticamente" },
          ]}
          layoutNota="A planilha pode ter várias abas; todas são processadas. O cabeçalho é detectado nas primeiras linhas."
          acao={<DistribuicaoTstImport onImported={refresh} />}
        />

        <Secao
          titulo="Atualizar Dossiês"
          descricao="Atualiza o número do dossiê dos processos já cadastrados, usando o número CNJ como chave."
          comoUsar={[
            "Selecione a planilha exportada do Benner com Nº do Dossiê e Número do processo.",
            "O sistema localiza cada processo pelo número e atualiza apenas o dossiê.",
            "Linhas sem correspondência são ignoradas.",
          ]}
          layout={[
            { col: "—", nome: "Nº Do Dossiê", exemplo: "12345/2024", obs: "Cabeçalho obrigatório" },
            { col: "—", nome: "Número", exemplo: "0000123-45.2024.5.10.0001", obs: "CNJ do processo" },
          ]}
          layoutNota="A ordem das colunas é livre; o sistema detecta pelos cabeçalhos 'Nº Do Dossiê' e 'Número'."
          acao={<DossieUpdateImport onUpdated={refresh} />}
        />

        <Secao
          titulo="Atualizar Equipe"
          descricao="Atualiza a equipe responsável por cada processo, usando o Dossiê como chave."
          comoUsar={[
            "Selecione a planilha com Processo (informativo), Dossiê e Equipe.",
            "O sistema localiza pelo Dossiê e atualiza a equipe.",
            "O prefixo 'Jurídico Trabalhista - ' é removido automaticamente do nome da equipe.",
          ]}
          layout={[
            { col: "A", nome: "Processo", exemplo: "0000123-45.2024.5.10.0001", obs: "Informativo (não é usado como chave)" },
            { col: "B", nome: "Dossiê", exemplo: "12345/2024", obs: "Chave de atualização" },
            { col: "C", nome: "Equipe", exemplo: "Jurídico Trabalhista - Equipe Renata", obs: "Prefixo é removido automaticamente" },
          ]}
          layoutNota="Todas as abas do arquivo são lidas. O cabeçalho geralmente está na linha 1."
          acao={<EquipeUpdateImport onUpdated={refresh} />}
        />

        {isAdmin && (
          <Secao
            titulo="Atualizar Situação de Envio"
            descricao="Atualiza a Situação de Envio (Carga I a VII) dos processos. Processos não encontrados são cadastrados com BENNER = SIM."
            comoUsar={[
              "Selecione a planilha com Processo, Dossiê e Tipo Carga (Carga I, II, III, IV, V, VI ou VII).",
              "Processos existentes têm a situação atualizada.",
              "Processos novos são cadastrados automaticamente como BENNER = SIM.",
            ]}
            layout={[
              { col: "—", nome: "Processo", exemplo: "0000123-45.2024.5.10.0001", obs: "Chave principal" },
              { col: "—", nome: "Dossiê", exemplo: "12345/2024", obs: "Opcional, mas recomendado" },
              { col: "—", nome: "Tipo Carga (ou Situação Envio)", exemplo: "Carga III", obs: "Aceita Carga I a Carga VII" },
            ]}
            layoutNota="Apenas a primeira aba é lida. Os cabeçalhos são detectados nas primeiras linhas."
            acao={<SituacaoEnvioUpdateImport onUpdated={refresh} />}
          />
        )}

        {isAdmin && (
          <Secao
            titulo="Resposta Santander"
            descricao="Atualiza dados retornados pelo Santander (data de distribuição, partes, dossiê, etc.) a partir da planilha de resposta padronizada."
            comoUsar={[
              "Selecione a planilha de resposta do Santander.",
              "Todas as abas são processadas; a aba de origem fica registrada.",
              "O Dossiê vem obrigatoriamente da coluna B desta planilha.",
              "Os dados retornados sobrescrevem o que estiver preenchido.",
            ]}
            layout={[
              { col: "A", nome: "Processo", exemplo: "0000123-45.2024.5.10.0001", obs: "Chave de localização" },
              { col: "B", nome: "Dossiê", exemplo: "12345/2024", obs: "Obrigatório nesta planilha" },
              { col: "O", nome: "Data de Distribuição", exemplo: "15/03/2024", obs: "Fallback se não houver cabeçalho" },
              { col: "P", nome: "Partes / Polos", exemplo: "Reclamante | Reclamada", obs: "Ignorado se contiver apenas '|'" },
              { col: "—", nome: "Demais colunas conforme planilha padrão Santander", obs: "Cabeçalhos detectados automaticamente" },
            ]}
            acao={<RespostaSantanderImport onUpdated={refresh} />}
          />
        )}

        <Secao
          titulo="Benner SIM (conferência)"
          descricao="Marca processos como Benner=SIM em massa a partir de uma planilha de conferência. Preenche dossiês vazios e cria processos novos quando necessário."
          comoUsar={[
            "Escolha um responsável (perfil da coordenação) para vincular aos processos novos criados.",
            "Selecione a planilha de conferência (.xlsx).",
            "Todas as abas são lidas; o sistema marca benner_atualizado=true para cada processo encontrado.",
            "Processos não encontrados são cadastrados como TST com Benner=SIM.",
          ]}
          layout={[
            { col: "—", nome: "Processo", exemplo: "0000123-45.2024.5.10.0001", obs: "CNJ — chave de localização" },
            { col: "—", nome: "Dossiê", exemplo: "12345/2024", obs: "Preenche dossiês vazios; opcional" },
            { col: "—", nome: "Reclamante", exemplo: "Fulano de Tal", obs: "Usado apenas em processos novos" },
            { col: "—", nome: "Data de Distribuição", exemplo: "15/03/2024", obs: "Aceita DD/MM/AAAA ou serial Excel" },
          ]}
          layoutNota="Não existe coluna 'Benner SIM/NÃO' na planilha — o sistema apenas usa a lista de processos para MARCAR benner_atualizado=true. Cabeçalhos são detectados nas 10 primeiras linhas de cada aba."
          acao={<BennerSimImport onUpdated={refresh} />}
        />
      </div>
    </MainLayout>
  );
}