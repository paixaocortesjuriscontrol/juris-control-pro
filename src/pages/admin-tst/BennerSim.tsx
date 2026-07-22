import { PaginaImportacao } from "@/components/admin-tst/SecaoImportacao";
import { BennerSimImport } from "@/components/distribuicao-tst/BennerSimImport";

export default function BennerSim() {
  return (
    <PaginaImportacao
      pageTitle="Benner SIM (conferência)"
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
      acao={<BennerSimImport onUpdated={() => {}} />}
    />
  );
}