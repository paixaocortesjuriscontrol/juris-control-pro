# Fazer a Judit trazer os nomes das partes

Conferi as consultas da tela de Distribuição TST dos últimos 7 dias: em vários casos o nome vem como iniciais (`S. O. A. P.`, `B. S. (. B. ). S. A.`) ou como "PARTE OCULTADA NOS TERMOS DA RES. 121 DO CNJ", sem que o processo esteja em segredo de justiça.

No caso 0000256-67.2025.5.06.0391 a própria resposta da Judit trazia, na mesma consulta, duas versões da mesma parte — uma ocultada e outra com o CPF. O sistema hoje olha só uma das instâncias e acaba gravando a pior versão.

## O que será feito

Uma única correção: ao ler a resposta da Judit, considerar **todas** as instâncias que vieram na mesma consulta e usar o nome completo sempre que ele existir em qualquer uma delas, casando as partes pelo CPF/CNPJ. Hoje isso só é feito parcialmente, olhando uma instância.

Nenhuma regra nova, nenhum botão novo, nenhuma consulta extra à Judit, nenhuma alteração de banco. Quando a Judit realmente não devolver o nome em nenhuma instância, nada muda em relação a hoje.

## Detalhe técnico

`supabase/functions/buscar-judit/index.ts`: montar o índice documento → melhor nome a partir de `rdSelecionada`, de todas as `page_data` do crawler e de `cache_lookup`, usando a função já existente `nomeAbreviadoOuOculto` para preferir nome completo sobre iniciais e sobre "PARTE OCULTADA"; aplicar esse índice em `extrairPartes`, `reclamanteFinal`/`reclamadaFinal`, `recorrente` e `parties_detail`.
