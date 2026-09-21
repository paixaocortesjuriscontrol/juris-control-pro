# Nome das partes faltando na pesquisa Judit

A reclamação da Dra. Kellen procede. Conferi as consultas Judit dos últimos 7 dias (153 pela tela de Distribuição TST) e encontrei três situações em que o nome não aparece, nenhuma delas por segredo de justiça:

1. **Nome abreviado** — a Judit devolve o nome em iniciais, por exemplo `S. O. A. P.` e `B. S. (. B. ). S. A.` (Banco Santander). 20 casos.
2. **"PARTE OCULTADA NOS TERMOS DA RES. 121 DO CNJ"** — o tribunal oculta o nome só naquela instância. 44 casos.
3. **Nenhuma parte retornada** — a consulta dá certo, mas volta sem lista de partes. 6 casos.

Em um caso que abri (0000256-67.2025.5.06.0391) a própria resposta da Judit trazia, na mesma consulta, a versão "PARTE OCULTADA" em um lugar e a versão com CPF em outro — ou seja, hoje o sistema escolhe a pior das versões disponíveis e não aproveita as outras instâncias que já vieram na mesma resposta.

## O que será feito

### 1. Sempre escolher a melhor versão do nome que a Judit devolveu
Hoje a busca por nome completo olha apenas a instância escolhida e a instância de origem. Passará a varrer **todas** as instâncias/páginas retornadas na mesma consulta, casando as partes pelo CPF/CNPJ, e usar sempre o nome mais completo. Ordem de preferência: nome completo > nome abreviado > "PARTE OCULTADA".

### 2. Banco Santander reconhecido pelo CNPJ
Quando o nome do banco vier abreviado (`B. S. (. B. ). S. A.`), ele é identificado pelo CNPJ e exibido com o nome correto.

### 3. Deixar claro quando o tribunal não divulga o nome
Se, mesmo depois disso, nenhuma versão completa existir na resposta:
- mostra o CPF/CNPJ da parte, quando a Judit informou, que é o que permite identificar quem é;
- mostra um aviso discreto "nome não divulgado pelo tribunal nesta instância", em vez de exibir só as iniciais sem explicação.

### 4. Consulta sem nenhuma parte
Quando a Judit responder sem lista de partes, a tela avisa "a Judit não retornou as partes desta consulta", em vez de ficar em branco sem explicação.

Nada é buscado em outras bases nossas e não existe botão novo de releitura.

## Detalhes técnicos

- `supabase/functions/buscar-judit/index.ts`: generalizar `completarNome`/`mapDocNomeCompleto` para um índice documento → melhor nome, construído a partir de `rdSelecionada`, de todas as `page_data` do crawler e de `cache_lookup`; usar `nomeAbreviadoOuOculto` (já existente) na ordem de preferência. Aplicar em `extrairPartes`, `reclamanteFinal`/`reclamadaFinal`, `recorrente` e `parties_detail`.
- Reconhecimento do Santander por CNPJ usando a lista de nomes já presente no arquivo.
- Front: exibição do CPF/CNPJ e dos avisos em `src/components/distribuicao-tst/PartesProcessoTab.tsx` e `src/components/benner/DadosBennerPartesTab.tsx`; sem alterar as regras de reclamante/reclamada nem o preenchimento automático de campos.
- Nenhuma alteração de banco; nenhuma consulta Judit adicional cobrada.
