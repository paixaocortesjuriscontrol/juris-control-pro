# Remanejamento: separar por tipo e escolher cada data

## O que foi conferido (a reclamação procede)
Cada formulário guarda datas diferentes:

| Tipo | Datas do formulário |
|---|---|
| Tarefa | Data base, Data prevista (obrigatória), Data fatal (opcional) |
| Prazo | Data base, Data limite, Data fatal |
| Evento | Data/hora de início, Data/hora de fim |

Problemas da tela atual:
- Uma única regra de data valia para todos os tipos, e só mexia na "data prevista/limite" (tarefa e prazo) e no início (evento).
- Em eventos, o fim não acompanhava o início, então podia terminar antes de começar.
- A data base nunca era ajustada, e a data fatal só com uma opção genérica.

## Como vai ficar
1. **Escolha do tipo no topo:** Tarefas, Prazos ou Eventos, um de cada vez. Trocar de tipo limpa a seleção. Não dá para misturar tipos numa mesma alteração.
2. **Lista com as colunas do tipo:**
   - Tarefas e prazos: Data base, Data prevista/limite, Data fatal.
   - Eventos: Início, Fim.
3. **Um bloco de regra para cada data do tipo.** Em cada data, escolha:
   - Manter;
   - Definir nova data;
   - Adiar/antecipar N dias, com opção de "cair em dia útil".
   Os blocos mostram o nome da data como no formulário, por exemplo "Data fatal".
4. **Eventos:** há a opção "mover o fim junto com o início", marcada por padrão. Ela mantém a duração e a hora do evento.
5. **Prévia antes de aplicar:** cada coluna mostra a data atual e, ao lado, a nova data destacada. Uma trava impede gravar:
   - uma data fatal antes da data prevista/limite, com aviso na linha;
   - um fim de evento antes do início.
6. **Confirmação final:** um resumo mostra, por exemplo, "12 prazos: Data limite +3 dias úteis; Data fatal mantida; responsáveis trocados por X".
7. **Responsáveis:** as opções continuam as mesmas: manter, trocar ou acrescentar.

## Detalhes técnicos
- `RemanejamentoTarefasSheet.tsx`:
  - o estado `tipoAtivo` substitui os chips de tipos;
  - o filtro `tipos` vai para `[tipoAtivo]`;
  - `regras: Record<campo, {modo, data, dias, diaUtil}>`.
- Campos: tarefa/prazo usam `data_base`, `data_vencimento` e `data_fatal`; evento usa `data_inicio` e `data_fim`, preservando a hora no fuso America/Sao_Paulo.
- `usePessoasEmLote`: o select passa a trazer também `data_base`, `data_fatal` e `data_fim`, e `LoteItem` ganha o campo opcional `datas`. A tela "Pessoas em lote" continua igual.
- A gravação é feita item a item, e os erros de cada item aparecem no resumo.
