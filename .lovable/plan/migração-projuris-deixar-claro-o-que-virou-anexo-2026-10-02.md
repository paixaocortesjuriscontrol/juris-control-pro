# Migração Projuris — deixar claro o que virou anexo

## Objetivo
Na etapa 1 (Arquivos) da tela `/migracao-projuris`, mostrar com clareza quantos anexos foram detectados em cada zip e de onde eles vieram, evitando a dúvida "como está importando anexos se não enviei o zip de anexos?".

## Mudanças em `src/pages/MigracaoProjuris.tsx`

1. **Resumo por zip**: na lista "Zips de anexos", cada zip passa a mostrar:
   - total de arquivos de anexo detectados dentro dele;
   - quantas planilhas foram lidas de dentro dele (ex.: "3 planilhas lidas como tarefas, 12 arquivos tratados como anexos").
2. **Lista expansível de anexos**: cada zip ganha um botão "ver arquivos" que abre a lista dos nomes dos arquivos detectados como anexo (primeiros ~50, com contador do restante), para o usuário conferir antes de importar.
3. **Aviso quando não há anexos**: se nenhum zip tiver arquivos de anexo, exibir texto explícito: "Nenhum anexo detectado — serão importadas apenas as tarefas das planilhas."
4. **Aviso quando o zip de planilhas contém anexos**: se um zip enviado como "planilhas" contiver outros arquivos, mostrar aviso amarelo: "Este zip também contém X arquivos que serão tratados como anexos."
5. **Etapa 3 (Conferência)**: o cartão "Anexos ligados / sem vínculo" passa a indicar a origem (nome do zip) de cada grupo.

## Detalhes técnicos
- O estado `zips` já guarda `{ file, entries }`; basta expor contagens e nomes (`entries.map(e => e.filename)`) na UI, sem mudar a lógica de leitura.
- Guardar também a quantidade de planilhas internas por zip (hoje só vai para o toast).
- Nenhuma mudança no banco de dados nem na lógica de importação/vínculo — apenas apresentação.

## Verificação
- `npx tsgo --noEmit -p tsconfig.app.json` sem erros e `/tmp/observability/build-errors.log` com "build OK".
