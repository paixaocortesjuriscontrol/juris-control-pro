# Nome das partes faltando na pesquisa Judit

A reclamação da Dra. Kellen procede. Conferi as consultas Judit dos últimos 7 dias (446 no total, 153 pela tela de Distribuição TST) e encontrei três situações em que o nome não aparece, nenhuma delas por segredo de justiça:

1. **Nome abreviado** — a Judit devolve o nome em iniciais, por exemplo `S. O. A. P.` e `B. S. (. B. ). S. A.` (Banco Santander). 20 casos.
2. **"PARTE OCULTADA NOS TERMOS DA RES. 121 DO CNJ"** — o tribunal oculta o nome só naquela instância. 44 casos.
3. **Nenhuma parte retornada** — a consulta dá certo, mas volta sem lista de partes. 6 casos na tela de Distribuição TST.

Em um caso que abri (0000256-67.2025.5.06.0391) a resposta da Judit trazia, na mesma consulta, a versão "PARTE OCULTADA" em um lugar e a versão abreviada com o CPF em outro — ou seja, hoje o sistema escolhe a pior das versões disponíveis e não tenta completar o nome com as outras fontes que já estão na mesma resposta.

## O que será feito

### 1. Sempre escolher a melhor versão do nome na resposta da Judit
Hoje a busca por um nome completo olha apenas a instância escolhida e a instância de origem. Passará a varrer **todas** as instâncias/páginas retornadas mais o datalake da Judit, casando as partes pelo CPF/CNPJ, e usar sempre o nome mais completo encontrado. Ordem de preferência: nome completo > nome abreviado > "PARTE OCULTADA".

### 2. Completar com o que já temos na nossa base
Quando nem uma versão completa vier da Judit, o nome é buscado na nossa própria base, pelo número do processo:
- publicações do DJEN do mesmo processo (polo ativo/passivo e partes);
- ficha do processo já cadastrada (reclamante/reclamada);
- partes já gravadas em consultas anteriores do mesmo processo.

O valor só é usado para preencher o que está vazio/abreviado/ocultado — nunca sobrescreve um nome completo vindo da Judit.

### 3. Deixar claro na tela quando o nome não existe em nenhuma fonte
Nesses casos (o tribunal realmente não divulga), em vez de mostrar `B. S. (. B. ). S. A.` seco:
- exibe o CPF/CNPJ da parte quando a Judit informou, que é o que permite identificar quem é;
- mostra um aviso discreto "nome não divulgado pelo tribunal nesta instância";
- o Banco Santander abreviado é reconhecido pelo CNPJ e exibido com o nome correto.

### 4. Consulta sem nenhuma parte
Quando a Judit responder sem lista de partes, a tela avisa "a Judit não retornou as partes desta consulta" e oferece o botão para repetir a consulta forçando releitura, em vez de simplesmente ficar em branco.

## Detalhes técnicos

- `supabase/functions/buscar-judit/index.ts`: generalizar `completarNome`/`mapDocNomeCompleto` para um índice documento → melhor nome construído a partir de `rdSelecionada`, de todas as `page_data` do crawler e de `cache_lookup`; incluir a detecção de "PARTE OCULTADA" e de nomes em iniciais na escolha (função `nomeAbreviadoOuOculto` já existe). Aplicar em `extrairPartes`, em `reclamanteFinal`/`reclamadaFinal`, em `recorrente` e em `parties_detail`.
- Fallback local na mesma função (service role): consultar `publicacoes_djen` (polo_ativo/polo_passivo/partes_json), `processos` (reclamante/reclamados) e `partes_processo_benner` pelo processo em dígitos; marcar em `_judit_meta` a origem do nome (`judit` | `base_local`) para auditoria.
- Reconhecimento do Santander por CNPJ (a lista de nomes já existe no arquivo) para substituir a forma abreviada.
- Front: `src/components/distribuicao-tst/PartesProcessoTab.tsx`, `src/components/benner/DadosBennerPartesTab.tsx` e o aviso no resultado da consulta em `src/lib/juditDistribuicaoTst.ts` (sem alterar as regras de reclamante/reclamada nem o preenchimento automático de campos).
- Nenhuma alteração de banco; nenhuma consulta Judit adicional cobrada.
