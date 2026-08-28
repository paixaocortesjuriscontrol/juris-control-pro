# Ajuste de mensagem quando a Judit não encontra a instância TST

## Problema
Na Distribuição TST, o alerta âmbar "A Judit ainda não indexou a instância TST deste processo..." é exibido toda vez que a resposta da Judit não contém a instância TST, inclusive quando o clique acabou de disparar uma consulta real (sem reaproveitar cache). Nesse caso a mensagem é confusa: o usuário acabou de forçar uma atualização, então não faz sentido instruí-lo a usar "Forçar atualização" novamente.

## Objetivo
Distinguir, no frontend, entre:
1. **Resposta vinda do cache local do dia** sem instância TST → manter a mensagem atual, porque forçar a atualização pode trazer a instância TST.
2. **Resposta de consulta real (crawler) que não trouxe a instância TST** → mostrar mensagem mais precisa, sem sugerir "Forçar atualização" como se a consulta tivesse vindo de cache.

## O que muda

### 1. Edge Function `buscar-judit`
- Incluir no `_judit_meta` um campo `app_cache: boolean` já presente, mas garantir que também indique `consulta_real: true` quando o resultado não veio do `app_cache_hoje`.
- Quando a resposta for do cache local do dia, manter `app_cache: true` e `respondido_do_cache: true`.
- Quando a resposta vier do crawler (cache_ttl=0, polling real), marcar `consulta_real: true`.

### 2. Frontend `DistribuicaoTstForm.tsx`
- Ajustar a lógica que define `tstIndisponivel` para também armazenar se a origem foi cache ou consulta real.
- Renderizar dois textos distintos no banner âmbar:
  - **Cache do dia sem TST**: "A Judit ainda não indexou a instância TST deste processo. Tipo de recurso, relator, turma e situação não podem ser preenchidos automaticamente enquanto a instância do TST não aparecer na base da Judit. Preencha manualmente ou tente novamente com 'Forçar atualização'."
  - **Consulta real sem TST**: "A Judit não localizou a instância TST deste processo nesta consulta. Tipo de recurso, relator, turma e situação não podem ser preenchidos automaticamente. Preencha manualmente."
- O botão "Forçar atualização" continua disponível, mas a mensagem de consulta real não o sugere como solução imediata.

### 3. Toast de aviso
- Ajustar o toast exibido em `handleBuscarJudit` para refletir a mesma distinção: toast de cache mantém a sugestão de forçar; toast de consulta real informa apenas que a instância TST não foi localizada.

## Verificação
- Abrir um registro na Distribuição TST e clicar em Judit em um processo que ainda não tenha TST na Judit.
- Na primeira consulta do dia (consulta real), o banner não deve mencionar "Forçar atualização".
- Na segunda consulta do mesmo dia, se o cache local for usado e ainda não houver TST, o banner original deve aparecer com a sugestão de forçar.
