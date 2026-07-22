import { PaginaImportacao } from "@/components/admin-tst/SecaoImportacao";
import { RespostaSantanderImport } from "@/components/distribuicao-tst/RespostaSantanderImport";

export default function RespostaSantander() {
  return (
    <PaginaImportacao
      pageTitle="Resposta Santander"
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
      acao={<RespostaSantanderImport onUpdated={() => {}} />}
    />
  );
}