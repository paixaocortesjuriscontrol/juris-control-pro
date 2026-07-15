## Problema

No TST com `tipo=parte` para termos populares (GOL, VRG, EPB), a paginação é longa e o CNJ devolve 500 numa página específica. Aumentar retries não resolve — o backend do CNJ simplesmente não consegue montar aquela página com 50 itens. Precisamos reduzir o **payload por request** quando isso acontece.

## Solução

Ativar automaticamente um modo de "página menor" **só quando** uma página falha com 500/429 após as tentativas atuais. Nada muda para páginas que respondem 200.

### Comportamento em `buscarPaginado` (`monitor-servidor/engines/paralela.js`, linhas 933-1008)

Fluxo atual (resumido):
```
para cada page em 0..1000:
  tenta até 4x com size=50
  se falha persistente: incrementa failedStreak (aborta após 3 seguidas)
```

Novo fluxo:
```
tamanhoAtual = 50
para cada janela até esgotar:
  tenta a janela com tamanhoAtual (até 4x, mesmo backoff)
  se 200 → processa itens, avança página, mantém tamanhoAtual
  se 500/429 persistente e tamanhoAtual == 50:
    tamanhoAtual = 10
    recalcula posição: nova página inicial = pageAtual * 5
                       janela final = (pageAtual+1) * 5
    refaz APENAS aquela janela original (5 sub-páginas com size=10)
    se todas as 5 sub-páginas OK → volta tamanhoAtual = 50 e segue
  se 500/429 persistente com tamanhoAtual == 10:
    mantém o failedStreak atual (aborta após 3 seguidas, como hoje)
```

### Detalhes técnicos

1. **Cálculo de posição:** o CNJ pagina por offset implícito (`pagina * itensPorPagina`). Para reprocessar a janela da página P (size=50) em size=10, buscamos as páginas `P*5, P*5+1, P*5+2, P*5+3, P*5+4` com `itensPorPagina=10`. Cobre exatamente os mesmos 50 itens.

2. **Dedup já existente:** `seen` (Set por `id_djen`) já garante que qualquer sobreposição eventual não duplica. Sem risco de contagem inflada.

3. **Volta a size=50:** após a janela problemática ser vencida com size=10, o loop volta a size=50 na próxima página. Se cair de novo em 500, repete o degrau. Isso evita perder velocidade quando o problema é pontual.

4. **Streaks de encerramento (`emptyStreak`, `noNewStreak`):** contam sobre a janela lógica original de 50 itens, não sobre cada sub-página de 10. Uma janela = 5 sub-páginas → só considera "vazia" se as 5 vierem vazias; "sem itens novos" se as 5 juntas não trouxerem nada novo. Assim não encerramos cedo demais.

5. **Escopo:** aplica-se automaticamente a qualquer termo/tribunal/tipo, mas na prática só dispara em TST/parte (único cenário onde 500 aparece). Sem flag, sem condicional por tribunal.

### Fora de escopo

- Sem split por `meio` (D/E), sem split por `orgaoJulgador`, sem palavra-chave, sem Judit, sem alterar Motor Browser, sem mudar validação de parte, sem mexer em `falhasRefila.js`.
- Não altera `MAX_TENTATIVAS` nem backoff atual (4 tentativas, 3s/8s escalonando) — a redução de payload é o mecanismo principal; retry continua igual.

### Verificação após deploy

- Log novo em `buscarPaginado`: quando entra em modo size=10, registrar `[paginado] janela X reduzida a size=10 após 500`. Contagem desses logs deve ser baixa (só nos termos problemáticos).
- `SELECT count(*) FROM execucoes_servidor_falhas WHERE dia_brt=CURRENT_DATE AND ultimo_erro LIKE 'HTTP 5%'` deve cair para próximo de zero.
- GOL/VRG/EPB no TST/parte devem terminar `concluido`.

### Arquivo alterado

- `monitor-servidor/engines/paralela.js` — apenas a função `buscarPaginado` (linhas 933-1008). Nenhum outro arquivo.
