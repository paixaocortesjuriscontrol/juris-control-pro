# Corrigir a tela Valida Kurier — comparar por login

## O que está errado (confirmado na base)

A tela sempre mostra "Total Kurier 0" porque o campo "Coordenação Kurier" já vem preenchido com uma coordenação que **não existe mais** (por isso o campo aparece em branco na tela). Com esse filtro inválido, o lado Kurier volta vazio e tudo cai em "Só DJEN".

Além disso, escolher duas coordenações à mão não corresponde ao jeito como as coisas estão organizadas na base:

- As publicações do Kurier ficam guardadas em coordenações próprias, uma por login: "Kurier - paixaoc - Somente Kurier", "Kurier - paixaoc.08 - Somente Kurier" etc.
- As publicações do DJEN Termos Servidor ficam nas coordenações reais das equipes (Dra. Beatriz Costa, Dr. Thomás, Santander Cível...).
- A ligação entre o login do Kurier e as coordenações reais já está cadastrada na tela DJEN Servidor (cada login mostra "3 coord.", "1 só K", "1 só DJEN").

Ou seja, a regra de cruzamento em si funciona — conferido na base de setembro: 5.036 publicações do Kurier e 5.295 do DJEN, com praticamente todas casando por processo + data. O que quebra é o filtro de coordenação escolhido na mão.

## Como a tela vai funcionar

1. **Sem escolher coordenação na mão.** Os dois campos de coordenação saem. No lugar entra **Login do Kurier** (com a opção "Todos os logins ativos"), usando exatamente as coordenações já vinculadas àquele login no DJEN Servidor.
2. **Para cada login, o cruzamento certo:** de um lado o que o Kurier trouxe naquele login; do outro o que o DJEN Termos Servidor trouxe nas coordenações reais ligadas a esse mesmo login.
3. **O foco passa a ser "Só Kurier".** A aba principal, já aberta, é a lista do que **o Kurier achou e o DJEN não achou** — é essa a informação que o coordenador precisa ver. "Só DJEN" e "Em ambos" continuam disponíveis nas outras abas.
4. **Uma linha por login no resumo.** Tabela com login, coordenações comparadas, total Kurier, total DJEN, em ambos, só Kurier, só DJEN e o percentual de cobertura — dá para ver de imediato qual login está trazendo coisa que o DJEN perde.
5. **Coluna da coordenação nas listas.** Cada publicação mostra em que coordenação real ela deve ser tratada, além de tribunal, processo, órgão e data.
6. **Avisar quando um lado vier vazio**, em vez de exibir 0 e 0,0% sem explicação.
7. **Casamento com tolerância de 1 dia** na data, mantendo prioridade pelo identificador do DJEN — evita apontar como divergência a mesma publicação registrada em dias vizinhos.
8. **Não travar o navegador.** Hoje a tela baixa mais de 100 mil linhas para comparar no navegador. A comparação passa a ser feita no banco; a tela recebe os totais e as listas de divergência. As exportações CSV/Excel continuam completas, agora com uma aba por login.

## Validação

- Comparar o dia de hoje com "Todos os logins ativos" e conferir que "Em ambos" deixa de ser zero.
- Conferir um login específico contra a base: total Kurier, total DJEN e as coordenações usadas.
- Conferir que a lista "Só Kurier" traz publicações que realmente não existem no lado servidor.
- Conferir que CSV e Excel batem com os números da tela.

## Detalhes técnicos

- Vínculo login → coordenações: `kurier_credencial_coordenacoes` (`credencial_id`, `coordenacao_id`, `captura_total`, `somente_kurier_only`, `somente_djen_only`) + `kurier_credenciais.login`.
- Lado Kurier: `publicacoes_djen` com `fonte = 'kurier'` e `kurier_login = <login>` (essas linhas caem nas coordenações "Kurier - … - Somente Kurier"). Lado DJEN: `publicacoes_djen` / `publicacoes_djen_servidor` com `fonte <> 'kurier'` nas coordenações reais vinculadas ao login (excluindo as marcadas `somente_kurier_only`).
- Nova RPC `public.comparar_kurier_djen_por_login(p_logins text[], p_ini date, p_fim date)` — SECURITY DEFINER, `search_path = public`, `GRANT EXECUTE TO authenticated` — devolvendo, por login: totais, em ambos, só Kurier, só DJEN, quebra por tribunal e as linhas de divergência (processo, tribunal, órgão, tipo, datas, `id_djen`, coordenação). Cruzamento por `id_djen` e, no fallback, por dígitos do processo com `abs(data - data) <= 1` sobre `coalesce(data_disponibilizacao, data_publicacao)`.
- `src/pages/ValidaKurier.tsx`: remover `KURIER_COORD_DEFAULT_ID`, os dois `Select` de coordenação, `fetchAll`, `comparar`, `dedupeDjenRows` e a validação "Escolha coordenações diferentes"; adicionar o seletor múltiplo de login (fonte: `useKurierCredenciais`, apenas `ativo`), consumir a RPC via `useQuery`, `defaultValue="soKurier"` nas abas, tabela-resumo por login e coluna de coordenação em `PubTable`.
- Exportações: `exportCSV` com a coluna Login; `exportXLSX` com aba "Resumo por login" e abas "Só Kurier", "Só DJEN", "Em ambos".
