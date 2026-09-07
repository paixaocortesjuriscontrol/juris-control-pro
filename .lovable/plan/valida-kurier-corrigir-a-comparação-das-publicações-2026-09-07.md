# Valida Kurier — corrigir a comparação das publicações

## Como está sendo feita hoje

1. Lado Kurier: as publicações do login escolhido.
2. Lado DJEN: apenas as publicações que caíram nas coordenações marcadas para aquele login (e, por padrão, tirando as marcadas "só Kurier").
3. Casa as duas listas pelo identificador do DJEN ou pelo número do processo com tolerância de 1 dia.

## O que está errado (conferido na base, login paixaoc, 01–07/09/2026)

- **Kurier: 1.556 publicações. O DJEN achou 1.203 delas** — mas só 206 numa coordenação vinculada ao login e 997 em outras coordenações (Dr. Thomás e demais equipes). Como a tela só olha as coordenações vinculadas, essas 997 aparecem como "só Kurier". Resultado: 1.411 de "só Kurier" quando a falta real é de cerca de 350.
- **A coordenação com mais publicações do DJEN é justamente a que é descartada.** A ligação do login com "Coordenação Dr. Thomás" está marcada como "só Kurier", e o filtro padrão exclui esse tipo — ou seja, as 238 publicações do DJEN daquela equipe nunca entram na comparação.
- **O total do DJEN está dobrado.** A tela soma a lista principal (167) com a tabela antiga do motor Servidor (366), que guarda as mesmas publicações. Daí o "Total DJEN 533" desse período, que não corresponde a 533 publicações distintas.
- **Publicações descartadas como repetidas contam como falta.** 151 dessas 1.556 foram capturadas pelo DJEN e descartadas por repetição; hoje entram em "só Kurier".

## Como vai passar a funcionar

1. **"O DJEN achou" passa a valer em qualquer coordenação.** Se o DJEN trouxe a publicação em qualquer equipe, ela conta como achada — e a lista mostra em qual coordenação ela está, para dar para ver quando caiu na equipe errada.
2. **Publicação capturada e descartada como repetida conta como achada.**
3. **Sem contagem dobrada:** cada publicação do DJEN é contada uma vez, mesmo estando na lista principal e na tabela antiga do motor Servidor.
4. **"Só Kurier" passa a ser o que o DJEN realmente não capturou em lugar nenhum** — é essa a lista que interessa.
5. **O tipo de vínculo (Captura total / Só Kurier / Termos DJEN)** deixa de restringir o que entra na comparação e passa a servir só para escolher quais logins e coordenações aparecem no resumo, sem apagar publicações do lado DJEN.
6. **"Só DJEN"** passa a ser o que o DJEN trouxe nas coordenações do login e o Kurier não trouxe naquele login (sem duplicidade).

## Validação

- Repetir paixaoc, 01–07/09/2026: "em ambos" deve ficar perto de 1.203 e "só Kurier" perto de 350, com Total DJEN sem o valor dobrado.
- Conferir na lista "Só Kurier" alguns processos direto na base, confirmando que não existem em nenhuma coordenação do DJEN nem nas descartadas.
- Rodar o período completo (01/08 a 07/09) e conferir que a tela responde em segundos.

## Detalhes técnicos

- Nova versão de `public.comparar_kurier_djen_por_login(p_logins text[], p_ini date, p_fim date, p_limite integer, p_vinculos text[])` (SECURITY DEFINER, `search_path = public`, `GRANT EXECUTE TO authenticated, service_role`):
  - Lado DJEN de referência para o casamento (`d_all`): `publicacoes_djen` (`fonte IS DISTINCT FROM 'kurier'`) + `publicacoes_djen_descartadas` (`fonte IS DISTINCT FROM 'kurier'`) + `publicacoes_djen_servidor`, **sem filtro de coordenação**, janela `p_ini - 1` a `p_fim + 1`, materializado em dois índices: `DISTINCT id_djen` e `DISTINCT (pn, dref ± 1)`.
  - `kf`: cada linha Kurier marca `achou` contra `d_all` e guarda a coordenação onde o DJEN achou (`coord_djen`, via `LEFT JOIN` no primeiro match por `id_djen` e depois por `pn/dref`).
  - `total_djen` passa a ser `count(DISTINCT coalesce(id_djen, pn||dref))` sobre as coordenações vinculadas ao login, eliminando a soma dobrada com `publicacoes_djen_servidor`.
  - `coords` (coordenações do login) continua sendo usada para o lado "só DJEN" e para a coluna de coordenações do resumo, mas o `CASE` de `p_vinculos` deixa de excluir `somente_kurier_only` por padrão — passa a filtrar apenas quando `p_vinculos` traz seleção explícita.
  - `linhas` ganha a coluna `coordenacao_djen` para o caso "achou em outra coordenação".
- `src/pages/ValidaKurier.tsx`: exibir `coordenacao_djen` na tabela de "Em ambos", ajustar rótulos dos cards ("Só Kurier = o DJEN não capturou em nenhuma coordenação") e incluir a nova coluna nas exportações CSV/Excel.
