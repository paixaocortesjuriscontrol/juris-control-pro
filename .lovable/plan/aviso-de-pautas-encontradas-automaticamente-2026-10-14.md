# Aviso de pautas encontradas automaticamente

## O que a conferência mostrou
- O DJEN Termos Servidor terminou em 14/10/2026 às 05:00 (Brasília) e a rotina rodou em seguida.
- Existem **21 pautas "Auto DJEN · a avaliar"** na tela Pautas de Julgamento; a mais recente foi criada em 14/10/2026 às 05:00, logo após essa execução.

## O que será feito
1. Na tela Pautas de Julgamento, um aviso azul no topo: "X pautas encontradas automaticamente pelo DJEN aguardando avaliação (última busca em dd/mm/aaaa hh:mm)".
2. Botão no aviso **Ver pautas novas**, que filtra a lista só nas pautas automáticas a avaliar (em qualquer semana).
3. O aviso some quando todas forem avaliadas; botão "Dispensar" esconde até chegar uma pauta nova.
4. Um pequeno contador no item "Pautas de Julgamento" do menu, só para a Coordenação Dra. Renata Oficial.

## Detalhes técnicos
- Contagem: `pautas_tst` com `origem='djen_auto'` e `status_avaliacao='a_avaliar'`, mais `max(created_at)`.
- Dispensa guardada por usuário no navegador com a data da última pauta vista.
- Sem mudança no banco.
