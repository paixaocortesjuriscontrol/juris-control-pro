# Corrigir "processo não cadastrado" na Análise DJEN

## O que está acontecendo

O processo 0000044-80.2026.5.10.0009 está cadastrado no sistema (área Trabalhista, criado em 02/08/2026), mas na tela Análise DJEN algumas publicações dele aparecem como não cadastradas, com o botão de importar.

Causa confirmada: as publicações do DJEN guardam o número só com números (00000448020265100009), enquanto o cadastro do processo guarda com pontos e traço (0000044-80.2026.5.10.0009). Em um dos caminhos de carregamento da lista, a comparação é feita letra por letra, sem ignorar essa diferença de formatação — então o sistema não encontra o processo e oferece importar. No outro caminho a comparação já ignora a formatação, o que explica por que umas publicações do mesmo processo mostram "Processo Cadastrado" e outras não.

## O que será feito

- Igualar a comparação nos dois caminhos de carregamento da lista, sempre desprezando pontos, traços e barras do número.
- Assim, qualquer publicação de um processo já cadastrado passa a exibir "Processo Cadastrado", com o atalho para abrir o processo, e deixa de oferecer importação duplicada.
- Nenhum dado é alterado no banco: é só a forma de comparar.

## Detalhes técnicos

- Arquivo: `src/hooks/usePublicacoesDjenUnificadas.ts`.
- No caminho de fallback (queries diretas, ~linhas 975-1020): hoje monta `processosExistentesMap` com a chave `p.numero` literal e resolve com `processosExistentesMap[pub.processo_numero]`.
- Ajuste: gerar os candidatos com `raw`, dígitos e `formatarCnjPorDigitos(digits)` no `.in('numero', ...)`, indexar o mapa por dígitos e resolver `processo_id` pelos dígitos de `pub.processo_numero` — mesmo padrão já usado no caminho da RPC (`resolveProcessoIdsPromise`, ~linhas 737-765).
- Aplicar o mesmo ajuste em `src/hooks/usePublicacoesDjenServidorUnificadas.ts` se ele repetir a comparação literal.
- Depois, validar com o processo 0000044-80.2026.5.10.0009 que as publicações de 11/09 e 14/09 mostram o mesmo selo.
