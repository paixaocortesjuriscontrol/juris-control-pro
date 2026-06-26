## Causa da lentidão

Nas últimas mudanças adicionei retries "imediatos" para buscas vazias em três lugares diferentes do `src/hooks/useDjenTermosParalelaEngine.ts`, e eles se sobrepõem. Para CADA monitoramento × tribunal × termo OR, hoje rodamos:

**Advogado (por termo)**
1. Busca por nome
2. Se vazio: `sleep 1500ms` + refaz por nome (linhas 1486-1492)
3. Se ainda vazio + OAB/UF: `sleep 800ms` + fallback OAB (1503-1521)
4. **De novo** no final: se `resultados.length === 0` → `sleep 1500ms` + refaz `baseParams` (1555-1584) — redundante com o passo 2

**Parte (por termo)**
1. Busca por parte
2. Se vazio: `sleep 1500ms` + refaz (1435-1444)
3. Se ainda vazio e veio de VPS: `sleep 1500ms` + refaz no Direto (1445-1455)

Multiplicando por ~30 tribunais e por monitoramentos com vários termos OR (caso típico do TST/TRTs do Dr. Thomás), isso adiciona minutos por execução só em sleeps de retry vazio — exatamente o que o usuário está sentindo agora.

## Correção

Manter UMA única camada de retry por termo, igual ao Servidor:

### `src/hooks/useDjenTermosParalelaEngine.ts`

1. **Remover** o bloco de retry global no fim de `processarTermoEmTribunal` (linhas 1552-1584). Ele só fazia sentido antes do retry interno em `buscarAdvogado`; hoje é duplicado.
2. **Reduzir** o delay do retry interno de advogado de 1500ms → 600ms (linha 1487).
3. **Remover** o retry adicional VPS→Direto para `parte` quando a 1ª passada já fez retry no mesmo via (linhas 1445-1455). Mantemos só o retry simples da linha 1435-1444 (com delay reduzido de 1500ms → 600ms).

Sem isso, cada termo "vazio" custa hoje 3-4× mais tempo do que precisa. Com o ajuste, mantemos a robustez contra resposta vazia intermitente da API mas voltamos à velocidade anterior.

Não mexer em: dedup (regra coord+id_djen), validação de metadados, paginação `continueUntilEmpty`, ou no Servidor.

## Validação

Você roda a Paralela novamente (mesma coordenação que está demorando) e compara o tempo total / "tempo decorrido" no card com a execução anterior. Esperado: cair para o patamar de antes.
