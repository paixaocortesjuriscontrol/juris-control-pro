import { PaginaImportacao } from "@/components/admin-tst/SecaoImportacao";
import { PedidosPorDossieDialog } from "@/components/distribuicao-tst/PedidosPorDossieDialog";

export default function PedidosPorDossie() {
  return (
    <PaginaImportacao
      pageTitle="Pedidos por Dossiê"
      titulo="Pedidos por Dossiê"
      descricao="Importa a planilha de pedidos (matérias) por dossiê, usada para destacar em verde as matérias previstas na ficha do processo na Distribuição TST."
      comoUsar={[
        "Selecione a planilha com o número do Dossiê e os pedidos separados por barra vertical (|).",
        "A importação substitui os pedidos dos dossiês presentes na planilha; dossiês fora da planilha não são afetados.",
        "Pedidos que ainda não existem na lista oficial de matérias são cadastrados automaticamente.",
        "Ao final, um resumo mostra dossiês processados, vínculos criados e pedidos novos cadastrados.",
      ]}
      layout={[
        { col: "A", nome: "Dossiê", exemplo: "12345/2024", obs: "Número do dossiê" },
        { col: "B", nome: "Pedidos", exemplo: "Horas extras | Adicional de insalubridade", obs: "Separados por |" },
      ]}
      layoutNota="Valores vazios e 0 são ignorados. A comparação dos pedidos ignora acentos e maiúsculas/minúsculas."
      acao={<PedidosPorDossieDialog />}
    />
  );
}
