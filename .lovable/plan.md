# Migração Projuris: modelos só a partir do tipo de tarefa

## Problema
Hoje a importação só bloqueia modelos quando o título veio da coluna "Descrição". Mas no Projuris muitos textos longos de providências estão na coluna "Título" da tarefa, e esses viraram modelos (os 274 removidos na rodada das 23h15).

## Regra nova
- Modelo de tarefa só é criado a partir do **tipo de tarefa do Projuris** (cadastro de tipos).
- Títulos vindos do título livre da tarefa ou da descrição **nunca** criam modelo novo.
- A tarefa continua com o texto como título; só fica sem modelo (ou ligada ao modelo do seu tipo, se existir).
- Um texto livre não é mais ligado a um modelo só por ter o mesmo nome; a ligação acontece pelo código do tipo Projuris ou pelo nome do tipo.
- O relatório passa a mostrar quantos títulos foram preenchidos pelo tipo, pelo título livre e pela descrição, e quantos modelos foram criados.

## Detalhes técnicos
- `planejarNovosModelosTitulosProjuris` (`src/lib/migracaoProjuris.ts`): aceitar só linhas com `fonteTitulo === "tipo"`, usando o nome do tipo (`nmtarefatipo`) como nome do modelo.
- `BackupCompletoProjuris.tsx`: `modeloDe` e o vínculo por título usam somente o nome do tipo, não `l.titulo` quando este veio do título livre/descrição; relatório ganha a contagem "pelo título original".
- Testes em `migracaoProjuris.test.ts`: título original e descrição não geram modelo; tipo gera um único modelo por código.
- Sem mudanças no banco.
