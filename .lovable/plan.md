# Migração Projuris separada em 5 importações

## Objetivo
Dividir a tela Migração Projuris em cinco importações independentes, feitas nesta ordem. Cada uma tem a própria conferência, o próprio relatório e o botão de desfazer:

```text
1. Processos  ->  2. Tarefas  ->  3. Anexos  ->  4. Comentários  ->  5. Andamentos
```

As importações seguintes usam o que as anteriores já gravaram. Assim, tarefas, comentários e andamentos são ligados aos processos e tarefas já migrados, mesmo em rodadas diferentes.

## Como fica a tela
- No topo, cinco abas: Processos · Tarefas · Anexos · Comentários · Andamentos.
- Cada aba mostra um contador do que já foi migrado para a coordenação, por exemplo "1.240 processos migrados".
- Dentro de cada aba, o mesmo fluxo de hoje:
  - enviar os arquivos;
  - diagnóstico (sugere quais planilhas servem para aquela aba);
  - conferir colunas;
  - conferência (nada é gravado);
  - importar em lotes;
  - relatório em Excel.
- O diagnóstico já indica a aba certa de cada tipo de planilha, com o botão "usar nesta aba".

## O que cada aba faz
1. **Processos**
   - Cria os processos a partir da planilha de processos do Projuris: número CNJ, pasta, partes, vara/comarca e cliente.
   - Não duplica processos: o número é comparado em todas as coordenações.
   - Se o processo já existe em outra coordenação, esta coordenação entra como responsável.
   - A consulta à Judit fica opcional e vem desligada.
2. **Tarefas**
   - Igual à importação atual: tipo definido pelo título e responsáveis reconhecidos.
   - Os processos são ligados pelo número. Se o processo ainda não existe, a tarefa fica no relatório como "processo não migrado", ou é criada sem processo, conforme a opção escolhida.
3. **Anexos**
   - Só os zips.
   - Cada arquivo é ligado à tarefa (pelo identificador) ou ao processo (pelo número) já migrados.
4. **Comentários**
   - Planilha de comentários/históricos das tarefas.
   - Cada comentário é ligado à tarefa pelo identificador do Projuris e mantém o autor e a data original.
   - Se o autor não for reconhecido, o comentário fica com quem importou, com o nome original no texto.
5. **Andamentos**
   - Planilha de andamentos/movimentações.
   - Cada andamento é ligado ao processo pelo número e grava data e descrição, sem repetir o mesmo andamento.

## Detalhes técnicos
- Refatorar `src/pages/MigracaoProjuris.tsx` em uma moldura com abas e componentes por tipo, em `src/components/migracao/`, reaproveitando leitura, diagnóstico e lotes.
- Os registros em `migracoes_projuris_itens` usam os tipos `processo`, `tarefa`, `anexo`, `comentario` e `andamento`. A ligação entre rodadas é feita por `chave_externa`, e "desfazer lote" remove cada um desses tipos.
- Comentários vão para `comentarios_tarefas` (autor_id, conteudo, created_at original).
- Andamentos vão para `movimentacoes` (processo_id, data_movimentacao, descricao, fonte = 'projuris'), sem repetir a combinação processo + data + descrição.
- Novos campos em `src/lib/migracaoProjuris.ts` para processos, comentários e andamentos, com reconhecimento automático das colunas.
- O banco só muda se o campo de tipo de `migracoes_projuris_itens` tiver uma restrição que impeça os tipos novos.
- Registrar a regra no AGENTS.md: as importações Projuris são separadas por tipo e ligadas por `chave_externa`.

## Pendência
Os nomes exatos das colunas das planilhas de processos, comentários e andamentos serão confirmados pelo diagnóstico. Um print do diagnóstico ajuda a acertar o reconhecimento.
