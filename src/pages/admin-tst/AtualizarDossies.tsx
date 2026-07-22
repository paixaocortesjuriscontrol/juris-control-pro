import { PaginaImportacao } from "@/components/admin-tst/SecaoImportacao";
import { DossieUpdateImport } from "@/components/distribuicao-tst/DossieUpdateImport";

export default function AtualizarDossies() {
  return (
    <PaginaImportacao
      pageTitle="Atualizar Dossiês"
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
      acao={<DossieUpdateImport onUpdated={() => {}} />}
    />
  );
}