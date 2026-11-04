# Importação automática de distribuições TST a partir do DJEN

## O que a Dra. Lienne vai ter
1. **Mesmo esquema das Pautas de Julgamento:** quando o DJEN Servidor termina, o sistema lê sozinho as publicações do TST dos últimos 7 dias com a **mesma regra do botão "Docs TST"** e pega só as de **"Lista de Distribuição"** (sem duplicar o que já foi lido).
2. Cada processo identificado entra na tela **Distribuição TST** com:
   - etiqueta nova **"DJEN AUTOMÁTICO"**;
   - **Data da distribuição** = data da publicação;
   - **Data de lançamento no sistema** = quando a rotina gravou.
3. **Se o processo já estava na tela**, ele não é duplicado: recebe a etiqueta e fica marcado como "já estava no sistema" (guardando a data original de cadastro). Isso permite o filtro do fim do mês: *cadastrados pela rotina* x *distribuídos que já existiam*.
4. **Filtros novos** na tela: "Origem: DJEN automático", "Já existia / Novo" e período por **data de lançamento** (além do período por data de distribuição que já existe).
5. **Botão "Relatório para Dra. Iara"**: gera planilha igual ao modelo enviado — colunas *Processo, Dossiê, Equipe, Data da Distribuição, Pedidos, CENTRALIZADOR* — com os processos filtrados/selecionados na tela (Dossiê, Equipe e Pedidos em branco quando ainda não preenchidos).
6. A exclusão do que não é da base continua pela tela, como hoje (arquivar/excluir em lote).
7. Botão **"Buscar agora"** na tela, igual ao das Pautas, liberado para as mesmas pessoas (admin e membros da coordenação TST).

## Ponto a confirmar
- Nome da etiqueta: proponho "DJEN AUTOMÁTICO".

## Detalhes técnicos
- Espelhar `gerar_pautas_tst_auto`: nova função de banco `gerar_distribuicoes_tst_auto(dias)` (SECURITY DEFINER, sem execução por anon/authenticated), chamada pelo mesmo gatilho pós-conclusão em `execucoes_servidor`; RPC `buscar_distribuicoes_tst_agora()` com a mesma checagem de acesso de `buscar_pautas_tst_agora`.
- A função aplica em SQL a regra de "Lista de Distribuição" de `classificarPublicacaoTst.ts` (com a precedência TEMAS_IRR/CEJUSC antes); teste compara amostras reais entre a regra da tela e a do banco.
- Upsert em `dados_benner` por número normalizado sem sobrescrever campos preenchidos: `data_distribuicao_real` = data da publicação, `fontes_importacao` += 'djen_auto', novas colunas `importado_djen_em` e `ja_existia_antes_djen`; etiqueta via `dados_benner_processo_tags`. RLS existente preservada.
- Relatório XLSX com datas DD/MM/AAAA no layout do modelo.
- Atualizar versão, notas e manual.
