## Diagnóstico
- A execução atual da DJEN Paralela está ativa há quase 30 minutos e o TST está preso em `100/148` termos.
- O TST está sofrendo muito mais chamadas e rate limit que os demais: `143` chamadas na mesma VPS e `26` HTTP 429 só no TST.
- Há `112` monitoramentos ativos que atingem TST do tipo `parte`, além de advogado/palavra-chave/processo. Isso aumenta bastante o volume.
- No caminho principal da Paralela, termos `tipo='parte'` já são enviados como `nomeParte` e existe proteção removendo `palavraChave` se aparecer.
- Porém ainda há um caminho de fallback por Edge Function (`buscar-djen`) quando o browser/proxy acusa CORS/erro de rede. Esse fallback pode aumentar latência e foge da regra desejada de não usar caminhos alternativos para busca por parte.

## Plano de correção
1. **Bloquear fallback para `parte` na camada PJE Comunica**
   - Em `src/utils/pjeComunicaClient.ts`, quando `params.tipo === 'parte'`, falhas de CORS/rede devem retornar erro/resultado controlado, sem chamar Edge Function como proxy.
   - Manter apenas `nomeParte` na URL, sem `texto` e sem `palavraChave`.

2. **Adicionar trava explícita contra `texto/palavraChave` em `parte`**
   - Garantir que a montagem da URL de `parte` remove qualquer `texto` residual antes do fetch.
   - Logar erro claro se algum chamador tentar enviar `palavraChave` junto com `tipo='parte'`.

3. **Reduzir a lentidão específica do TST sem sacrificar cobertura**
   - Ajustar a paginação da Paralela para `tipo='parte'` parar quando a API retornar página com menos de `pageSize` ou sem itens novos, mantendo `continueUntilEmpty` para casos amplos como Santander.
   - Evitar retry automático alternativo para `parte`; a busca por parte já será uma única estratégia: `nomeParte`.

4. **Melhorar distribuição de carga do TST nas VPS**
   - Revisar o worker atual, que entrega o TST inteiro a uma única VPS até terminar.
   - Se a mudança for pequena e segura, separar o TST em unidades menores por termo/dia para não ficar monopolizado por uma VPS; caso contrário, manter essa etapa fora deste hotfix para não alterar demais a arquitetura.

5. **Verificação**
   - Confirmar por busca no código que `tipo='parte'` não envia `palavraChave` nem `texto`.
   - Conferir no banco/execução se novas rodadas mostram TST avançando sem fallback por palavra-chave e com menos 429.