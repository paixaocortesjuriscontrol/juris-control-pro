# Menu do processo: voltar a exibir "Monitoramento" (Análise Judit + Partes)

## Por que não aparece
O grupo **Monitoramento** com "Análise Judit" e "Partes" continua no código (`src/components/processos/ProcessoDetalhesCompletos.tsx`, array `navGroups`) — nada foi removido e não há filtro de permissão.

O problema é visual: o menu lateral do processo é um `ScrollArea` com `max-h-[calc(100vh-112px)]` e `sticky top-0` dentro de uma área que já rola. A lista fica cortada na altura da tela (termina em "Cobrança"), e os grupos seguintes — **Monitoramento** (Análise Judit, Partes), **Distribuições** e **Interação** — não são alcançáveis.

## O que fazer
Nada muda de posição: o menu fica exatamente como era, com Análise Judit e Partes no grupo Monitoramento. Apenas corrigir a rolagem do menu lateral para que a lista completa volte a ser acessível até o último grupo.

## Detalhes técnicos
- Arquivo: `src/components/processos/ProcessoDetalhesCompletos.tsx` (sidebar desktop, ~linha 1027).
- Trocar `max-h-[calc(100vh-112px)]` por altura fixa `h-[calc(100vh-112px)]` no `ScrollArea`, para o viewport do Radix ter altura própria e a barra de rolagem funcionar.
- Ajustar o `aside` (`self-start` / evitar `overflow-hidden`) se ele estiver limitando a rolagem.
- `navGroups` permanece intacto; sem mudanças de dados, permissões ou banco.

## Verificação
Abrir um processo no desktop e rolar o menu lateral: os grupos **Monitoramento** (Análise Judit, Partes), **Distribuições** e **Interação** aparecem e os itens abrem normalmente. No mobile o menu horizontal continua igual.
