## Diagnóstico

A execução Kurier rodou: 10/10 credenciais, 20 lotes cada, **7141 publicações recebidas**, mas **0 novas / 0 dup / 7141 descartadas** e `kurier_publicacoes_raw` está vazia.

A única forma de incrementar `descartadas` sem inserir em `raw` é cair no primeiro `if (!idK) { totalDescartadas++; continue; }` em `kurier-consultar-publicacoes/index.ts` linha ~193. Ou seja: o `pickId()` não reconhece o nome do campo de identificador no payload retornado pela Kurier.

Hoje `pickId` procura: `id`, `Id`, `idPublicacao`, `IdPublicacao`. A Kurier muito provavelmente devolve outro nome (ex.: `idDocumento`, `IdDocumento`, `numero`, `Numero`, `protocolo`, etc.) e ainda pode ser que os campos `conteudo`/`numero_processo` também tenham nomes diferentes do que `pickStr()` espera.

A pergunta sobre rotear pelas VPS fica para um segundo momento — primeiro precisamos fazer o matching funcionar.

## Plano de correção

### Passo 1 — Capturar o shape real do payload Kurier

Em `supabase/functions/kurier-consultar-publicacoes/index.ts`:

- Logar `console.log("[kurier] payload sample lote 0:", JSON.stringify(pubs[0]).slice(0, 1500))` na primeira publicação de cada execução.
- Logar `console.log("[kurier] keys:", Object.keys(pubs[0] ?? {}))` para enxergar todos os nomes de campos.
- **Importante:** mesmo quando `idK` for null, inserir em `kurier_publicacoes_raw` com `id_kurier = 'unknown_<hash>'` para a gente conseguir inspecionar o payload depois sem precisar rodar de novo.

Implantar e clicar "Buscar Kurier com termos DJEN". Olhar os logs e a primeira linha de `kurier_publicacoes_raw` para ver o JSON cru.

### Passo 2 — Ajustar `pickId` e `pickStr`

Com os nomes reais em mãos, ampliar:

- `pickId`: incluir variações detectadas (esperado algo como `idDocumento`, `IdDocumento`, `numeroDocumento`, `protocolo`, `cdDocumento`).
- `pickStr` para conteúdo: incluir `mensagem`, `Mensagem`, `descricao`, `Descricao`, `textoPublicacao`, `corpo`.
- `pickStr` para número de processo: incluir `numProcesso`, `nrProcesso`, `processoNumero`, `numeroProcessoFormatado`.
- `pickStr` para datas: incluir `dataMovimento`, `dtDisponibilizacao`, `dtPublicacao`.

### Passo 3 — Tornar o descarte rastreável

Mesmo após corrigir o `pickId`, gravar **todas** as publicações recebidas em `kurier_publicacoes_raw` (com `publicacao_djen_id = null` quando descartada por não-match). Isso permite reprocessar offline sem consumir a fila Kurier de novo.

Adicionar coluna `motivo_descarte text` em `kurier_publicacoes_raw` (`sem_conteudo`, `sem_processo`, `sem_match_monitoramento`, `excluido_por_termo`, `id_nao_reconhecido`) para entendermos por que cada publicação foi descartada.

### Passo 4 — Validar matching contra monitoramentos

Com `raw` populado, rodar uma query manual:

```sql
SELECT motivo_descarte, count(*) 
FROM kurier_publicacoes_raw 
WHERE publicacao_djen_id IS NULL 
GROUP BY 1;
```

Se sobrar muito `sem_match_monitoramento`, validar manualmente um payload contra `conteudoContemTermoOuOr` — pode ser que precisemos relaxar o matching (Kurier já filtra pelo lado deles, então quase tudo deveria casar com algum monitoramento).

### Passo 5 — Re-executar e medir

Botão "Buscar Kurier com termos DJEN" novamente. Esperado: agora as `novas` e `dup` passem a contar e as publicações apareçam em Análise DJEN com `fonte = 'kurier'`.

## Sobre VPS (resposta direta à pergunta original)

Tecnicamente sim, mas só faz sentido depois que o matching estiver OK. Quando for o caso, o caminho recomendado é:

- A própria edge function ler a tabela `djen_proxy_pool` e fazer o fetch via `<vps>/proxy?url=<kurier-url-encoded>` (dialeto v3), mantendo o login/senha server-side.
- Round-robin entre VPS ativas para distribuir IP e driblar rate-limit do `kurierservicos.com.br`.

Não recomendo chamar Kurier direto do browser via VPS porque isso exporia a senha Kurier descriptografada no client.

## Arquivos afetados

- `supabase/functions/kurier-consultar-publicacoes/index.ts` (Passos 1, 2, 3)
- Nova migration adicionando `motivo_descarte` em `kurier_publicacoes_raw` (Passo 3)
