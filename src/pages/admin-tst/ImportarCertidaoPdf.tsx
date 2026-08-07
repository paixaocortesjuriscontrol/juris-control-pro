import { PaginaImportacao } from "@/components/admin-tst/SecaoImportacao";
import { CertidaoPdfImport } from "@/components/distribuicao-tst/CertidaoPdfImport";

export default function ImportarCertidaoPdf() {
  return (
    <PaginaImportacao
      pageTitle="Importar PDF Certidão de Distribuição"
      titulo="Importar PDF Certidão de Distribuição"
      descricao="Cadastra novos processos a partir do PDF da Certidão de Distribuição do TST. Caso o processo já exista na base de dados, a data de distribuição será atualizada."
      comoUsar={[
        "Clique no botão ao lado e selecione o PDF da Certidão.",
        "O sistema lê cada linha do PDF (número CNJ + data) e cadastra os processos faltantes.",
        "Processos já existentes têm a data de distribuição atualizada e recebem um comentário no card.",
      ]}
      layoutNota="Entrada em PDF (não é planilha). Cada linha do PDF deve conter o número CNJ no formato 0000000-00.0000.0.00.0000 seguido da data DD/MM/AAAA. Tolerante a quebras de espaço (ex.: '0000092 - 91 . 2024 . 5 . 09 . 0088')."
      acao={<CertidaoPdfImport onImported={() => {}} />}
    />
  );
}