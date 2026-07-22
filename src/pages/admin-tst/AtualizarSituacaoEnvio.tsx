import { PaginaImportacao } from "@/components/admin-tst/SecaoImportacao";
import { SituacaoEnvioUpdateImport } from "@/components/distribuicao-tst/SituacaoEnvioUpdateImport";

export default function AtualizarSituacaoEnvio() {
  return (
    <PaginaImportacao
      pageTitle="Atualizar Situação de Envio"
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
      acao={<SituacaoEnvioUpdateImport onUpdated={() => {}} />}
    />
  );
}