# Reclamações da Dra. Lienne — Distribuição TST e Pautas

## 1) Pautas de julgamento: Ministro aparecendo como Reclamante e órgão como Reclamada

**Causa confirmada:** quando o processo não está na base Benner, a pauta pega as partes da própria publicação do DJEN. Em alguns casos, como agravos contra decisão da Presidência, a publicação traz como "partes" a autoridade ("MINISTRO ALOYSIO CORRÊA DA VEIGA - PRESIDENTE DO TST") e o órgão ("TRIBUNAL PLENO DO TST"). Hoje isso afeta 4 pautas de 2 processos (0000688-43.2023.5.10.0101 e 1001142-81.2021.5.02.0009).

**Correção:**
- Na criação automática das pautas, ignorar como parte os nomes que são autoridade ou órgão do tribunal: Ministro(a), Presidente do Tribunal, Tribunal Pleno, Turma, Órgão Especial, SBDI/SDC/Subseção e Corregedoria.
- Se sobrar só autoridade, Reclamante e Reclamada ficam vazios. O órgão continua no campo Órgão.
- Corrigir as 4 pautas que já existem: limpar Reclamante e Reclamada errados. Assim que o processo entrar na base Benner, a reverificação automática preenche os nomes certos.

## 2) Distribuições TST Arquivados: só aparecem os arquivados até 07/10

**Causa confirmada:** a tela carrega só os 500 arquivamentos mais recentes, mas há 12.883 arquivados (junho a novembro de 2026). Por isso os mais antigos não aparecem.

**Correção:**
- A lista passa a ser paginada, com navegação entre páginas e o total real de arquivados.
- A busca por processo ou dossiê continua procurando em todos os arquivados.
- Novos filtros: período de arquivamento, período de distribuição, "Só com dossiê" e "Origem" (por exemplo, Base PCA).

## 3) Restaurar em lote por período de distribuição

Além da opção atual por planilha, o botão "Restaurar em lote" ganha um segundo modo, **Por período**:
- **Data de distribuição:** de / até, em calendário. Exemplo: 01/01/2026 a 31/10/2026.
- **Só com número de dossiê:** marcado por padrão.
- **Origem:** Base PCA (padrão), Todas ou outra aba de origem.
- Antes de restaurar, mostra quantos processos serão restaurados e uma prévia. O usuário confirma, escolhe a tag como já acontece hoje e acompanha a barra de progresso, com opção de cancelar.

**Observação dos dados:** hoje há 260 arquivados vindos da Base PCA. Destes, 217 têm distribuição em janeiro de 2025, 1 em agosto de 2026 e 42 estão sem data de distribuição. Com o período de janeiro a outubro de 2026, entraria apenas 1. A prévia mostrará isso antes de qualquer restauração.

## Detalhes técnicos
- Nova migração em `gerar_pautas_tst_auto`, com helper `pauta_partes_polo` filtrando os nomes de autoridade por expressão regular. Também um UPDATE pontual nas 4 linhas de `pautas_tst` com `origem` djen_auto/planilha e reclamante ou reclamada de autoridade.
- `DistribuicaoTstArquivados.tsx`: `.range()` com `count: 'exact'`, filtros por `arquivado_em` e pelas chaves de data do `snapshot`. A data de distribuição usa, nesta ordem, `data_distribuicao`, `data_distribuicao_real` e `data_distribuicao_planilha`.
- Nova RPC `listar_arquivados_tst_por_periodo(de, ate, so_dossie, origem)` (SECURITY INVOKER, respeitando a RLS atual), usada pela prévia e pelo modo Por período em `RestaurarLoteArquivadosDialog.tsx`. A restauração reaproveita `restaurar_dados_benner_arquivado`, em lotes de 4.
