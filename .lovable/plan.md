## Para que serve o "Captura total Kurier (sentinela - não editar)"

Esse termo **não é uma busca de verdade**. É um marcador interno, criado automaticamente pela edge function `kurier-consultar-publicacoes` para coordenações configuradas no vínculo `kurier_credencial_coordenacoes` com a flag `captura_total = true`.

Como funciona:
- Quando um login Kurier tem coordenações em modo "captura total", **toda** publicação que o Kurier devolve naquela janela é gravada para a coordenação — sem precisar casar com nenhum termo cadastrado.
- Para essas linhas, o sistema precisa de algum `monitoramento_id` para gravar (a coluna é NOT NULL). Em vez de inventar um, a edge function cria/reutiliza um monitoramento "fantasma" com `termo_busca = '__CAPTURA_TOTAL_KURIER__'` e usa o id dele só como etiqueta.
- Nas telas Análise DJEN / DJEN Servidor, esse id é renderizado com o rótulo amigável "Captura total Kurier" (`AnaliseDjen.tsx:3573`, `AnaliseDjenServidor.tsx:3587`), pra você saber que aquela publicação veio em modo "tudo o que o Kurier mandou", não por casamento de termo.

## Por que está aparecendo executando nas VPSs (problema real)

O sentinela foi inserido em `monitoramentos_djen` como `ativo = true` e `tipo = 'palavra-chave'`. Os engines da DJEN Local (`useDjenTermosParalelaEngine.ts`) e do DJEN Servidor (`monitor-servidor/engines/paralela.js`) **não filtram esse termo**. Resultado: cada VPS está rodando uma busca real por `__CAPTURA_TOTAL_KURIER__` em todos os tribunais — é isso que aparece na sua tela como "Captura total Kurier (sentinela - não editar) … 99 termos … Google VPS X". Sempre retorna 0 e gasta quota à toa.

Ele só deveria ser usado pela edge function do Kurier — nunca pelas engines de busca DJEN.

## Plano

1. **Filtrar o sentinela na carga de monitoramentos**, em três pontos:
   - `src/hooks/useDjenTermosParalelaEngine.ts` (DJEN Local).
   - `monitor-servidor/engines/paralela.js` (DJEN Servidor, executado nas VPSs).
   - `src/hooks/useDjenTermosKurierScheduler.ts` e `useDjenTermosParalelaScheduler.ts`, para não agendarem o termo.
   
   Filtro: descartar todo monitoramento com `termo_busca === '__CAPTURA_TOTAL_KURIER__'` logo após carregar do banco. Assim ele continua existindo (necessário pro Kurier) mas nunca entra em fila de busca.

2. **Adicionar rótulo amigável também na própria lista de termos** (badge da execução), em vez de exibir o nome cru `__CAPTURA_TOTAL_KURIER__`, caso ele venha a aparecer em algum outro componente.

3. **Documentar nas telas DJEN Local/Servidor**, num tooltip discreto no rótulo "Captura total Kurier", o que esse marcador significa — para não gerar mais dúvida no futuro.

4. **Não mudar nada no edge function do Kurier** nem no schema; o sentinela continua sendo criado e usado como etiqueta. Só vai parar de ser executado pelos motores DJEN.

### Detalhes técnicos
- Após o deploy da função do servidor, será necessário um `git pull` + `pm2 restart` nas VPSs (mesmo procedimento de sempre).
- Não há migração de dados: as publicações antigas marcadas com o monitoramento sentinela continuam válidas e seguem com o rótulo "Captura total Kurier".
