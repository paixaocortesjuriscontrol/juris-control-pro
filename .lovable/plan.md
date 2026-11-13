# Conferência também para audiências e eventos

## Por que ficou de fora
Não há nada que impeça. Audiências e eventos ficam guardados em lugares diferentes das tarefas, cada um com suas próprias datas e sua própria lista de responsáveis. Para entregar logo, a primeira versão conferiu só prazos, tarefas e atas, que são os itens do caso da Dra. Janaina.

## O que muda
- A aba **Conferência** passa a mostrar uma linha por tipo (Prazos, Tarefas, Atas, Audiências, Eventos), com o total encontrado no sistema, o total na planilha e o resultado de cada um.
- A lista de faltantes ganha a coluna **Tipo**, que também passa a mostrar audiências e eventos.
- O aviso na tela soma todos os tipos escolhidos.

## Regras da conferência
- **Audiências:** contam pela data da audiência ou pela data de cadastro. Para o filtro de pessoas, o responsável é o advogado da audiência e o envolvido é quem está na lista de envolvidos.
- **Eventos:** contam pela data de início ou pela data de cadastro. Responsáveis e envolvidos vêm das listas do próprio evento.
- Eventos que repetem contam uma vez só, como já acontece na planilha.

## Detalhes técnicos
- `src/lib/conferenciaExportacao.ts`: adicionar `buscarAudienciasConferencia` (`audiencias_detectadas` + `audiencias_advogados`/`audiencia_envolvidos`) e `buscarEventosConferencia` (`eventos_agenda` + `evento_responsaveis`/`evento_envolvidos`), lidos em páginas de 1000 e em lotes por `inChunks`. O resultado ganha uma `origem` e a comparação usa as chaves `a:<id>`/`e:<id>`/`t:<id>`, iguais às usadas na exportação, devolvendo os totais por tipo.
- `PainelControle.tsx`: montar os IDs exportados por origem (`audiencia-det-<id>`, evento `<id>::…`).
- `relatorioAtividadesExcel.ts`: tabela de totais por tipo na aba Conferência.
- Antes de codar, conferir os nomes reais das colunas de data e de status em `eventos_agenda`.
- Testes novos: audiência pelo advogado responsável, evento recorrente contado uma vez, falta detectada por tipo.
