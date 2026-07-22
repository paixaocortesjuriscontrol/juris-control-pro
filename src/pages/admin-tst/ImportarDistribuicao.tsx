import { PaginaImportacao } from "@/components/admin-tst/SecaoImportacao";
import { DistribuicaoTstImport } from "@/components/distribuicao-tst/DistribuicaoTstImport";

export default function ImportarDistribuicao() {
  return (
    <PaginaImportacao
      pageTitle="Importar Planilha — Distribuição TST"
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
      acao={<DistribuicaoTstImport onImported={() => {}} />}
    />
  );
}