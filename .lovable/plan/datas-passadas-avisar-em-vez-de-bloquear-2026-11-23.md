# Datas passadas: avisar em vez de bloquear

## O que muda
Ao criar tarefa, ata, prazo, evento ou audiência com data anterior a hoje (horário de Brasília), o sistema deixa de bloquear. Em vez disso, mostra um aviso claro ("A data escolhida já venceu: dd/mm/aaaa") e salva a atividade com a data calculada ou escolhida.

Vale para todas as telas de criação: Análise DJEN (caso da Jéssica), Painel, Agenda, processo e workflows. Edições e importações continuam como estão (importações já só avisam).

## Detalhes técnicos
- `src/lib/dataPassada.ts`: trocar `MSG_DATA_PASSADA` por mensagem de aviso e adicionar helper `avisoSeDataPassada(datas[])` que retorna o texto ou vazio.
- `PrazoDialog.tsx`, `NovaTarefaDialog.tsx`, `AudienciaFormSimplificado.tsx`, `EventoDialog.tsx`: substituir o `toast.error + return` por `toast.warning` sem interromper o salvamento.
- Teste em `src/lib/dataPassada.test.ts`: data anterior a 23/11/2026 gera aviso; data de hoje não gera.
- Atualizar versão para v10.3.7 em `src/constants/version.ts`.
