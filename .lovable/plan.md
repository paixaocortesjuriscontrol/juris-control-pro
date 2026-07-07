## Plano

Nenhuma alteração de código.

**Motivo:** o motor DJEN Termos Servidor (`monitor-servidor/engines/paralela.js`) já extrai o número do processo de todos os campos possíveis do JSON da API PJE Comunica e, como fallback, via regex no conteúdo. Quando o DJEN publica um item sigiloso **sem** `numeroProcesso` e **sem** número no corpo (caso da publicação id_djen 661811046), não há origem de dado para preencher — o servidor não tem como recuperar.

A UI já cobre esse cenário: o cabeçalho mostra "Processo sob segredo de justiça" no lugar de "Processo -" quando detecta SIGILO nas partes/conteúdo (ajuste feito na resposta anterior).