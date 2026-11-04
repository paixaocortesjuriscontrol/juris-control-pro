# Importação automática de distribuições TST a partir do DJEN

## O que a Dra. Lienne vai ter
1. **Todo dia, automaticamente**, depois que o DJEN Termos (Servidor) terminar, o sistema lê as publicações do TST do dia com a **mesma regra do botão "Docs TST"** e pega só as que caem em **"Lista de Distribuição"**.
2. Cada processo identificado entra na tela **Distribuição TST** com:
   - etiqueta nova **"DJEN AUTOMÁTICO"**;
   - **Data da distribuição** = data da publicação;
   - **Data de lançamento no sistema** = quando a rotina gravou.
3. **Se o processo já estava na tela**, ele não é duplicado: recebe a etiqueta e fica marcado como "já estava no sistema" (guardando a data original de cadastro). Isso permite o filtro do fim do mês: *cadastrados pela rotina* x *distribuídos que já existiam*.
4. **Filtros novos** na tela: "Origem: DJEN automático", "Já existia / Novo" e período por **data de lançamento** (além do período por data de distribuição que já existe).
5. **Botão "Relatório para Dra. Iara"**: gera planilha igual ao modelo enviado — colunas *Processo, Dossiê, Equipe, Data da Distribuição, Pedidos, CENTRALIZADOR* — com os processos filtrados/selecionados na tela (Dossiê, Equipe e Pedidos saem em branco quando ainda não preenchidos).
6. A exclusão do que não é da base continua sendo feita pela tela, como hoje (arquivar/excluir em lote).
7. Botão **"Rodar agora"** (admin) para importar um dia específico manualmente, útil para recuperar dias passados (ex.: julho a outubro).

## Pontos a confirmar
- Nome da etiqueta: proponho "DJEN AUTOMÁTICO".
- Quais monitoramentos DJEN alimentam a rotina: proponho os das coordenações TST (as mesmas que veem a tela Distribuição TST).

## Detalhes técnicos
- Extrair a regra de `src/lib/classificarPublicacaoTst.ts` para uso compartilhado também por uma função de servidor (cópia fiel em `supabase/functions/_shared`), com teste garantindo que ambas classificam igual.
- Nova Edge Function `importar-distribuicoes-tst-djen`: lê `publicacoes_djen` do TST do dia (BRT), classifica, extrai CNJ, faz upsert em `dados_benner` por número normalizado (sem tocar campos já preenchidos), adiciona `fontes_importacao = 'djen_auto'`, `data_distribuicao_real` = data da publicação, aplica a etiqueta via `dados_benner_processo_tags` e grava histórico.
- Migração: colunas `importado_djen_em` (timestamptz) e `ja_existia_antes_djen` (boolean) em `dados_benner`; tag no catálogo; RLS existente preservada.
- Disparo: ao final da execução do DJEN Servidor (chamada encadeada), com um agendamento diário de segurança às 23h BRT caso a encadeada falhe.
- Relatório: exportação XLSX com datas DD/MM/AAAA, seguindo layout do modelo.
- Teste: classificação de amostra de distribuição e regra "já existia" x "novo".
- Atualizar versão, notas e manual.
