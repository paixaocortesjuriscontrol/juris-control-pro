# Trazer "Partes" de volta ao topo do menu do processo

## O que está acontecendo
O item **Partes** não desapareceu: no menu lateral do processo ele hoje está no grupo **Monitoramento**, junto de "Análise Judit" (confirmado em `src/components/processos/ProcessoDetalhesCompletos.tsx`, grupo `Monitoramento`). Como esse grupo fica bem abaixo de "Pedidos & Financeiro", ele só aparece rolando a lista — na altura da tela ele fica fora da área visível, dando a impressão de que sumiu.

Nenhum filtro de permissão remove o item; é apenas posição na lista.

## Correção proposta
Mover o item **Partes** para o grupo **Visão geral**, logo abaixo de "Visão Geral" e acima de "Auditoria", mantendo o mesmo `id` (`partes`), ícone e conteúdo (aba `ProcessoPartesTab`). O grupo Monitoramento fica só com "Análise Judit".

Resultado no menu:

```text
VISÃO GERAL
  Visão Geral
  Partes
  Auditoria
```

## Detalhes técnicos
- Arquivo único: `src/components/processos/ProcessoDetalhesCompletos.tsx`, array `navGroups` (~linhas 892-936).
- Remover `{ id: "partes", label: "Partes", icon: Users }` do grupo "Monitoramento" e inseri-lo no grupo "Visão geral".
- Nenhuma mudança de query, permissão ou banco de dados.

## Verificação
Abrir um processo e confirmar que "Partes" aparece no topo do menu lateral (desktop e no scroll horizontal do mobile) e que o clique continua abrindo a listagem de partes.
