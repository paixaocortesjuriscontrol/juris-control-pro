Conferi o CSV e o banco. Você tem razão: continua errado e não é só problema visual do comparador.

Achados objetivos do período 23/06/2026:
- Coordenação Dr. Thomás: Servidor 47, Browser 59, em ambos 43, só Servidor 4, só Browser 16.
- Coordenação Bruna Sousa Paiva GOL: Servidor 293, Browser 300, em ambos 293, só Browser 7.
- As diferenças das duas coordenações são reais por `coordenação + id_djen`.
- Bruna foi executada por último no servidor e ainda faltaram 7 capturas que já existiam no Browser.
- Thomás foi executada por último no servidor e o resultado mostra `novas: 0`, ou seja, o servidor não recuperou as 16 que o Browser já tinha.
- Encontrei uma causa concreta de divergência de código: para `parte`, o Browser tem fallback obrigatório para consulta direta quando a VPS retorna vazio sem erro; o Servidor não tem esse fallback. Isso explica lacunas como CPC/Bruna e OSMAR/Thomás quando a VPS/proxy devolve zero intermitente.
- Encontrei outra divergência concreta: validações/filtros de `advogado`, `palavra-chave`, exclusões e condição concomitante não estão 100% iguais entre Browser e Servidor. Em especial, o Browser ainda valida advogado também pelo texto completo; o Servidor está mais restrito, exceto complemento TST. Isso pode explicar capturas por advogado que aparecem só no Browser.

Plano de correção, sem mais mexidas cosméticas:

1. Tornar o Servidor fiel ao Browser nas chamadas de busca
   - Para busca por `parte`, adicionar no Servidor o mesmo fallback do Browser: se a VPS/proxy retornar 0 resultados sem erro, repetir a mesma consulta via rota direta antes de considerar vazio.
   - Manter deduplicação por `id_djen` para não dobrar registros.
   - Registrar no log quando o fallback direto resgatar resultados, para auditar se a lacuna vinha da VPS.

2. Igualar as regras de validação Servidor x Browser
   - Alinhar `validarTermo`, exclusões e condição concomitante do Servidor ao comportamento atual do Browser, sem inventar regra nova.
   - Remover divergência em que o Servidor valida `advogado` de forma mais restrita que o Browser.
   - Garantir que `parte` continue restrito a `nomeParte`/metadados/seção Parte(s), sem virar palavra-chave.

3. Corrigir o resgate entre coordenações para não depender de `ilike(conteudo, termo)` quando o termo só está em metadados
   - Hoje o resgate pode falhar se a publicação existente tiver o termo em `advogados_json` ou `partes_json`, mas não no `conteudo` pesquisável.
   - Ajustar para buscar candidatos por data/tribunal e validar com a mesma função de termo, em lotes limitados, ou por `partes_json/advogados_json` quando disponível.
   - Isso deve ajudar justamente quando uma coordenação já achou a publicação e outra coordenação deveria reaproveitar a mesma `id_djen`.

4. Melhorar auditoria do comparador para mostrar a causa provável
   - No CSV de exclusivos, incluir colunas `capturado_em`, `execucao_id` do servidor quando houver, e `provavel_causa` com valores como `faltou_no_servidor`, `faltou_no_browser`, `capturado_antes_da_execucao`, `validacao_divergente` ou `possivel_proxy_vazio`.
   - Manter o primeiro quadro como global por `coordenação + id_djen`, sem separação por tipo.

5. Validar nos dois casos que você apontou
   - Após implementar, comparar novamente especificamente Dr. Thomás e Bruna Sousa em 23/06/2026.
   - O critério de aceite é reduzir essas diferenças reais por `id_djen`; se sobrar diferença, ela deve aparecer no CSV com evidência suficiente para saber se foi API instável, proxy vazio, validação ou dado antigo.

Arquivos prováveis:
- `monitor-servidor/engines/paralela.js`
- `src/hooks/useDjenTermosParalelaEngine.ts` somente se for necessário centralizar/espelhar regra para evitar nova divergência
- `src/hooks/useDjenServidor.ts`
- `src/pages/DjenServidor.tsx`