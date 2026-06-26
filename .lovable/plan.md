## Objetivo

Simplificar a busca de advogados no DJEN para reduzir falsos positivos por nome curto (ex.: "CARLOS JOSE" casando com homônimos), mantendo a busca por OAB como rede de segurança.

## Regra nova de captura

Para cada termo de advogado parseado (`OAB/NOME`):

1. **Busca primária por nome**
   - Chama PJE Comunica com `nomeAdvogado=<NOME COMPLETO>` (sem OAB, sem UF).
   - Pagina com `continueUntilEmpty`.

2. **Fallback por OAB** (apenas se a busca primária retornar 0 publicações)
   - Se houver OAB e UF específica: `numeroOab` + `ufOab`.
   - Se UF=TODAS: busca por OAB sem UF (não suportada pela API → pula).
   - Sem chamada extra quando a busca por nome já trouxe algo.

3. **Validação de cada publicação retornada**
   - Extrai nomes de advogados de `destinatarioadvogados[].advogado.nome` (metadados estruturados) — fallback para regex no corpo só se metadados ausentes.
   - Normaliza (NFD, upper, sem pontuação).
   - **Regra de frase contígua**: aceita se o nome buscado aparece como subsequência **contígua de tokens** dentro de algum nome encontrado.
     - Buscado: `CARLOS ELIAS MIRANDA JUNIOR`
     - Encontrado `CARLOS ELIAS` → **descarta** (faltam tokens).
     - Encontrado `CARLOS ELIAS MIRANDA JUNIOR DE MEDEIROS` → **aceita** (contém o nome todo, mesmo sendo homônimo — descarte fica a cargo da advogada).
     - Encontrado `CARLOS ELIAS MIRANDA` → **descarta** (faltam tokens).
   - Validação por OAB (frase exata dos dígitos nos metadados ou no texto) é aceita como alternativa **apenas quando a publicação veio do fallback OAB**.
   - Remove o limite mínimo de 3 tokens — passa a valer a regra única "nome completo contíguo".

4. **Mantém**:
   - Loop por todos os `termos_or` (cada variação é um par OAB/NOME independente).
   - Exclusões, condição concomitante e regras de tribunal/coordenação inalteradas.
   - Cross-coordination rescue: continua somente no Browser; Servidor permanece isolado.

## Arquivos a alterar

- `src/hooks/useDjenTermosParalelaEngine.ts` (Browser)
  - Função de busca de advogado: trocar "OAB primário + suplemento" por "Nome primário + fallback OAB".
  - Função de validação: substituir o teste atual por "frase contígua de tokens do nome completo nos metadados".
- `monitor-servidor/engines/paralela.js` (Servidor — espelhar a mesma lógica).
- `supabase/functions/monitorar-djen/validation.ts` (opcional, para manter coerência caso seja chamado pelo cron — alinhar `conteudoContemTermo` tipo `advogado` à mesma regra de frase contígua).

## Impacto esperado

- Elimina os 5 vazamentos identificados na coordenação Dra. Vanessa TST (termos curtos tipo "10424/CARLOS JOSE" deixam de matchar nomes longos não relacionados).
- Reduz volume de chamadas à API: deixa de fazer Suplemento OAB+TODAS dentro do loop de `termos_or` (causa apontada da regressão de tempo, ~38 → ~14 calls por tribunal).
- Mantém recuperação por OAB quando o nome não bate (ex.: nome grafado diferente na publicação).

## Observações técnicas

- A "frase contígua" é implementada por tokens: tokeniza nome buscado e cada nome encontrado, depois testa `encontrado.join(' ').includes(buscado.join(' '))` após normalização.
- O fallback OAB é único por advogado e por execução — sem repetição dentro do loop de tribunais.
- Não altera schema, RLS, nem UI. Apenas motores de busca.
- Após aplicar, lembrar de `git pull` + `pm2 restart jc-monitor-servidor` no VPS.
