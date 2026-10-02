# Migração Projuris — Backup completo (estado em 02/10/2026, 17:56 BRT)

Tela: Administração → Migração Projuris → modo "Backup completo do Projuris" (`/migracao-projuris`, só admin).
Código: `src/components/migracao/BackupCompletoProjuris.tsx` (CSVs lidos em Web Worker).

## Como usar (pronto hoje)
1. Escolher a coordenação de destino.
2. Enviar o zip com as tabelas (ou CSVs avulsos) + Relatório(s) de Atividades `.xlsx`.
3. Clicar em **Analisar** (nada é gravado) e conferir os números.
4. Importar nesta ordem: **Processos → Tarefas → Andamentos**. Cada etapa tem relatório Excel e "desfazer lote".

## Ligações já implementadas
- Processo ↔ CNJ: `processo.cdprocesso` → `processonumero`.
- Andamentos: `andamentovinculomodulo` (cdmodulo=3) → processo. Tipo: `andamentotipo.nmandamentotipo`.
- Tarefa → processo (em ordem):
  1. Relatório de Atividades: Identificador `TAR.x` → "Processo Vinculado".
  2. Fluxos: `workflowexecucao` (módulo 4) → `workflowcontrole` (módulo 3) → processo (~19.458).
  3. Intimações: `tarefaevento.cdtarefa` → `cacheintimacaotarefa` → `intimacaonumeroprocesso` (~20.595).
  4. Sem ligação: tarefa entra solta, com aviso nas observações.
- Responsável: criador (usuario → pessoa → e-mail/nome).

## Números do backup
~21.730 processos · 122.240 andamentos · 98.260 tarefas (40.053 ligadas) · 36.376 anexos · 135 mil comentários.
Módulos Projuris: 3=processo, 4=tarefa/evento, 32=comentário, 35=arquivo, 38=responsáveis.

## Pedido feito à equipe Projuris (aguardando)
- `tarefavinculomodulo` — tarefa → processo (todas).
- `arquivovinculomodulo` — anexo → tarefa/processo.
- `comentariovinculomodulo` (ou equivalente) — comentário → tarefa/processo.
- `retarefaeventousuario` — responsável de cada tarefa.
- `reprocessousuario` — responsáveis de cada processo.
- `marcadorvinculomodulo` — etiquetas.
- Relatório de Atividades completo (sem filtros) como alternativa.
Arquivos físicos dos anexos: **já recebidos em 2 zips**.

## Próximos passos (segunda-feira)
1. Quando chegarem as tabelas de vínculo: adicioná-las em `TABELAS` e usar como ligação prioritária (mesmo padrão do `andamentovinculomodulo`).
2. Implementar etapa **Anexos**: ligar por `arquivovinculomodulo`; sem ela, usar CNJ no nome, CNJ no texto do PDF e tamanho do arquivo (`arquivo.csv`). Sem vínculo → relatório, nunca solto.
3. Implementar etapa **Comentários** só com tabela de vínculo.
4. Responsáveis por `retarefaeventousuario`/`reprocessousuario`; e-mail via `usuario-2`/`pessoaemail`.
5. Testar a tela logado como admin (teste automático indisponível neste projeto).

## Cuidados
Não repassar: `intimacaoassinantenovo`, `configuracaonotificacaomobile`, `credencialorgaosistema` (senhas/logins).
O arquivo `intimacao` (2 GB) não é necessário.
