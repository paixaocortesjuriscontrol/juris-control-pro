import { PaginaImportacao } from "@/components/admin-tst/SecaoImportacao";
import { EquipeUpdateImport } from "@/components/distribuicao-tst/EquipeUpdateImport";

export default function AtualizarEquipe() {
  return (
    <PaginaImportacao
      pageTitle="Atualizar Equipe"
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
      acao={<EquipeUpdateImport onUpdated={() => {}} />}
    />
  );
}