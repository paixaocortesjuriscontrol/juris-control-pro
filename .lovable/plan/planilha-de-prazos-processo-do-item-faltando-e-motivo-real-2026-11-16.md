# Planilha de prazos: processo do item faltando e motivo real

## O que aconteceu (conferido)
O item faltando é a **Contestação do processo 0000730-45.2026.5.10.0018** (Coordenação Dra. Janaina Catunda).
- Data fatal: **09/11/2026** (dentro do período escolhido)
- Data limite: **28/01/2027** (fora do período e **depois** da data fatal)

A conferência considera "data limite **ou** fatal", mas a planilha só pegou itens pela data limite. Como a data limite deste prazo está em 2027, ele ficou de fora. O motivo escrito na aba ("algum filtro do Painel ligado") estava errado neste caso.

## O que será feito
1. **Lista de faltantes com o processo:** acrescentar a coluna **Processo** (número CNJ) e também **Cliente**, logo depois do Título.
2. **Planilha igual à conferência:** quando a referência for "Data limite ou fatal", a planilha passa a trazer também prazos cuja data fatal está no período, mesmo com data limite fora dele. Assim esse prazo entra na planilha e a conferência fecha 41 de 41.
3. **Motivo correto por item:** na lista de faltantes, explicar o motivo de cada linha (ex.: "Data limite fora do período; só a data fatal está dentro" ou "Removido por filtro do Painel").
4. **Aviso de data limite depois da fatal:** marcar na planilha quando a data limite for posterior à fatal, como este caso.

## Detalhes técnicos
- `src/lib/conferenciaExportacao.ts`: incluir `processo_numero`/cliente em `ItemConferencia` e calcular motivo por item.
- `src/lib/relatorioAtividadesExcel.ts`: colunas Processo/Cliente e Motivo na tabela de faltantes.
- Consulta da exportação de prazos: completar com itens cuja `data_fatal` está no período quando a referência for "limite ou fatal", deduplicando por ID.
- Atualizar `conferenciaExportacao.test.ts` com o caso limite fora / fatal dentro.
