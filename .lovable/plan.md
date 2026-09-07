# Corrigir a tela Valida Kurier

## O que está errado (confirmado na base)

A tela sempre mostra "Total Kurier 0" porque o campo "Coordenação Kurier" vem preenchido com uma coordenação que **não existe mais** na base. Por isso o campo aparece vazio na tela e a busca do lado Kurier filtra por algo inexistente — resultado: zero publicações do Kurier e 100% "Só DJEN".

Verificações feitas na base (setembro/2026):
- Publicações do Kurier existem: 5.036 no período, todas com número de processo e data preenchidos.
- A coordenação usada por padrão no campo Kurier: 0 registros na tabela de coordenações e 0 publicações.
- Comparando os dois lados sem esse filtro quebrado, o cruzamento funciona: 5.295 de 5.036 do Kurier casam por processo + data (3.426 casam também pelo identificador do DJEN).

Ou seja: a regra de comparação em si está correta; o que impede o resultado é o filtro de coordenação.

## Correção

1. **Remover a coordenação fixa inválida.** O campo "Coordenação Kurier" passa a iniciar em "Todas as coordenações", igual ao lado DJEN, e a lista ganha essa opção.
2. **Comparar dentro da mesma coordenação por padrão.** Ao escolher uma coordenação no lado DJEN, o lado Kurier acompanha automaticamente (dá para desacoplar escolhendo outra manualmente). A validação que hoje **bloqueia** coordenações iguais é retirada — comparar a mesma coordenação nos dois lados é exatamente o uso normal.
3. **Avisar em vez de mostrar zero silencioso.** Quando um dos lados vier sem nenhuma publicação no período, a tela mostra uma mensagem explicando qual lado ficou vazio e sugerindo revisar coordenação/período, em vez de exibir "0" e 0,0% de cobertura.
4. **Casar publicações com mais tolerância de data.** Hoje o cruzamento exige a mesma data exata. Passa a aceitar também diferença de até 1 dia entre disponibilização/publicação, priorizando sempre o identificador do DJEN quando existir — isso evita marcar como divergência publicações iguais registradas em dias vizinhos.
5. **Não travar o navegador.** O período atual traz mais de 100 mil linhas para o navegador. A comparação passa a ser feita no banco, retornando apenas os totais, o resumo por tribunal e as listas de divergência limitadas; as exportações continuam completas.

## Validação

- Comparar o dia de hoje e conferir que "Em ambos" deixa de ser zero e que os totais de cada lado batem com a base.
- Comparar uma coordenação específica nos dois lados e conferir os números por tribunal.
- Conferir que CSV e Excel saem com as mesmas contagens exibidas na tela.

## Detalhes técnicos

- `src/pages/ValidaKurier.tsx`: remover `KURIER_COORD_DEFAULT_ID`, iniciar `coordKurierId` em `ALL_COORDS`, incluir a opção "Todas as coordenações" no segundo `Select`, espelhar a seleção do lado DJEN, e remover o `toast.error("Escolha coordenações diferentes")` de `executar()`.
- `comparar()`: manter prioridade por `id_djen`; no fallback por `processo+data`, testar `dateRef` e as datas ±1 dia, e considerar `data_publicacao` como alternativa de `data_disponibilizacao`.
- Nova RPC `public.comparar_kurier_djen(p_coord_djen uuid, p_coord_kurier uuid, p_ini date, p_fim date)` (SECURITY DEFINER, grants para `authenticated`) devolvendo totais, quebra por tribunal e as divergências; `fetchAll` deixa de paginar 100 mil linhas no cliente e passa a alimentar somente as abas de detalhe/exportação.
- Estado vazio: quando `totalDjen === 0` ou `totalKurier === 0`, renderizar aviso acima dos KPIs.
