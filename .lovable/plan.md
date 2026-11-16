# DJEN Cadernos (módulo experimental, separado do DJEN Servidor)

## Objetivo
Testar se baixar o caderno completo do dia de cada tribunal pela API do Comunica funciona melhor que a busca atual, sem tocar no DJEN Servidor, suas tabelas, agendamentos ou publicações.

## O que será feito
1. **Nova tela "DJEN Cadernos"** no menu Monitoramento (somente administradores, por ser teste).
2. **Escolher tribunal(is) e data** e clicar em Baixar. O sistema pede o caderno à API do Comunica e mostra: se baixou, tamanho, quantidade de comunicações e tempo gasto.
3. **Novas tentativas automáticas** quando houver bloqueio ou falha, com registro de cada tentativa (data e hora em BRT, código do erro).
4. **Busca dentro do caderno**: campo para pesquisar por nome de parte, advogado/OAB ou número do processo, respeitando a regra parte só em partes e advogado só em advogados.
5. **Comparação**: para a data escolhida, mostrar quantas comunicações o caderno trouxe versus o que o DJEN Servidor e o Kurier gravaram, para avaliar se vale a pena.
6. **Sem gravar publicações nas coordenações**: o resultado fica só no módulo de teste. Se funcionar, numa etapa futura decidimos como integrar.

## Detalhes técnicos
- Endpoint `comunicaapi.pje.jus.br/api/v1/caderno/{tribunal}/{data}/{meio}` (ainda não usado no projeto). Primeiro passo: testar TST e um TRT para confirmar formato e tamanho.
- Download pelo proxy da VPS já existente (`djen-proxy`), chamado por nova Edge Function `djen-cadernos-baixar` (verify_jwt, só admin via `has_role`). Nenhuma alteração em funções do DJEN Servidor.
- Novas tabelas isoladas: `djen_cadernos` (tribunal, data, meio, status, tamanho, total, tentativas), `djen_cadernos_tentativas` e `djen_cadernos_comunicacoes` (conteúdo extraído para busca). GRANT + RLS: leitura e escrita somente admin; service_role total.
- Arquivo bruto guardado em bucket privado `djen-cadernos`.
- Agendamento automático de madrugada fica para depois do teste manual dar certo.
