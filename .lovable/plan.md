# Por que as duas publicações não apareceram na Coordenação Dr. Thomás

Processo 0000671-18.2019.5.06.0017 — TRT6 — disponibilização 17/08/2026.

## O que a base mostra (verificado)

- As duas publicações **existem no sistema** (id_djen 698952741 e 698952770), mas gravadas na coordenação **"Kurier - paixaoc - Somente Kurier"**, via fonte `kurier`.
- Na Coordenação Dr. Thomás **não há registro** dessas duas publicações — nem em encontradas, nem em descartadas.
- Os monitoramentos do Dr. Thomás que alcançariam esse processo são dois, ambos com termo **BRADESCO** (um tipo `parte`, um `palavra-chave`), cobrindo TRT6, e **ambos exigem condição concomitante "OSMAR MENDES"**.
- Os advogados dessa publicação são ISAAC BERTOLINI AULER, FRANCISCO SAMPAIO DE MENEZES JUNIOR, FELIPE MEINEM GARBIN, RAPHAEL BERNARDES DA SILVA, ANTONIO MILLER MADEIRA e WILSON BELCHIOR — **não há OSMAR MENDES**.
- Prova histórica do mesmo processo: em 18/05/2026 o sistema capturou publicações desse processo por esses dois monitoramentos do Dr. Thomás e as **descartou com motivo `condicao_concomitante`**.
- Os demais monitoramentos do Dr. Thomás são por advogado (OSMAR MENDES PAIXÃO CORTES, CARLOS JOSÉ ELIAS JUNIOR, THOMAS RIETH MARCELLO) — nenhum figura na publicação. E o número desse processo **não está cadastrado como monitoramento tipo `processo`** em nenhuma coordenação.

## Conclusão

Não é falha de captura do DJEN: a publicação simplesmente **não atende ao critério configurado** na coordenação do Dr. Thomás. O filtro "BRADESCO + OSMAR MENDES" só deixa passar publicações em que Osmar consta como advogado; nesse alvará o intimado é a reclamante e os advogados listados são outros.

## Opções para corrigir (escolha do usuário)

1. **Monitoramento por processo**: cadastrar 0000671-18.2019.5.06.0017 como monitoramento tipo `processo` (TRT6) na coordenação do Dr. Thomás — pega tudo desse processo, independente de advogado.
2. **Ampliar a condição concomitante**: incluir os demais advogados do escritório (ex.: THOMAS RIETH MARCELLO) nos termos OR dos monitoramentos BRADESCO, ou remover a exigência de "OSMAR MENDES" quando a parte BRADESCO já for suficiente (isso aumenta muito o volume).
3. **Resgate por processo cadastrado**: se o processo estiver cadastrado em Processos e Casos na coordenação do Dr. Thomás, criar uma regra de resgate — publicação do dia cujo número pertence a processo da coordenação entra mesmo sem casar advogado/concomitante.
4. **Importar manualmente estas duas** publicações para a coordenação do Dr. Thomás (ação pontual, sem mudar regra).

## Detalhes técnicos

- Descartes são registrados em `publicacoes_djen_descartadas.motivo_descarte` (`sem_concomitante: <termo>`, `sem_match_parte`, `duplicada_lote`). Nos últimos dias a coordenação do Dr. Thomás teve 4 descartes por `sem_concomitante: OSMAR MENDES`.
- A opção 3 exigiria alterar o motor DJEN (servidor/browser) para consultar `processos`/`processos_coordenacoes_responsaveis` por dígitos do número antes de aplicar concomitante — mudança de lógica de captura, não só de configuração.
