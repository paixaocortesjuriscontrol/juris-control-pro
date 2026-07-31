# Matérias numeradas e fora da lista — origem e correção

## O que realmente aconteceu (verificado na base)

O registro **0000299-30.2020.5.09.0121 / 07.02.033.0002791426/20** foi criado em 08/05/2026 com `fontes_importacao = ["Planilha Distribuição"]`. Não houve IA nem anexos.

Os campos de matérias vieram como **texto livre da planilha importada**:

```text
materias_recurso_reclamante = "1. Justiça Gratuita para o ente sindical; 2. Majoração de honorários advocatícios."
materias_recurso_banco      = "1. Perda de objeto (...); 2. Julgamento Extra Petita (...); 3. ...; 4. ..."
```

O formulário não valida esse texto contra o cadastro de matérias: `parseMateriasString` apenas quebra a string por `;` e `reconcileMateriasAnalise` cria uma linha de análise para cada pedaço. Por isso aparecem itens "fora da lista" e com o `1.`, `2.` colado no nome — e esses mesmos textos são copiados para as colunas AB..AH da Carga Benner.

Resumo: **não é bug da IA nem da carga — é o texto da planilha de distribuição sendo aceito cru como matéria.**

## Correção proposta

1. **Sanitizar ao interpretar (`parseMateriasString`)**: além de quebrar por `;`, remover prefixos de enumeração (`1.`, `2)`, `3 -`, `•`) e ponto final solto no fim de cada item. Isso limpa tela, PDF e Carga Benner de uma vez, inclusive nos registros antigos.
2. **Casar com o cadastro de matérias**: ao interpretar, tentar reconciliar cada item com `materias_benner` (comparação sem acentos/caixa). Quando bater, usar o nome oficial do cadastro; quando não bater, manter o texto, mas marcar visualmente como "fora do cadastro" (badge/aviso na linha da análise), para a advogada corrigir ou cadastrar a matéria.
3. **Importação da Planilha Distribuição**: aplicar a mesma sanitização ao gravar `materias_recurso_*`, evitando que novos registros entrem numerados.
4. **Migração de dados (opcional, recomendado)**: limpar o prefixo numérico já gravado em `materias_recurso_*` e no campo `materia` dos JSONs `materias_analise_*` de `dados_benner`.

## Detalhes técnicos

- Regex: `^\s*(\d{1,2}\s*[.)\-–]\s*|[•\-]\s*)` aplicada uma vez por item; preserva parênteses, siglas e caixa do restante do texto.
- Sem mudança nas regras de pendência, dedupe, filtros por chance/aparelhamento ou no layout do template da carga.
- O item virtual "Outra Matéria" continua ignorado na análise e na planilha.
