# Menu do processo: "Partes" visível e menu completo

## Por que não aparece
O item **Partes** continua no código (confirmado em `src/components/processos/ProcessoDetalhesCompletos.tsx`, array `navGroups`) — ele está no grupo **Monitoramento**, junto de "Análise Judit". Esse grupo, mais "Distribuições" e "Interação", ficam depois de "Pedidos & Financeiro".

Nos dois prints o menu termina em "Cobrança": o menu lateral do processo é um `ScrollArea` com `max-h-[calc(100vh-112px)]` e `sticky top-0` dentro de outra área que já rola. Com isso a lista fica cortada na altura da tela e o restante (Monitoramento → Partes, Distribuições, Interação) não é alcançável na prática — não é permissão nem remoção do item.

## O que fazer

1. **Seção própria "Partes" no topo**: criar um grupo `Partes` logo abaixo de "Visão Geral", contendo o item `partes` (mantendo o mesmo id, ícone e a tela `ProcessoPartesTab` com Polo Ativo/Passivo/Terceiros e Testemunhas). O grupo "Monitoramento" fica só com "Análise Judit".

2. **Corrigir o corte do menu**: garantir que o menu lateral role por completo, com altura definida e rolagem própria, mantendo todos os grupos acessíveis (incluindo Monitoramento, Distribuições e Interação).

```text
VISÃO GERAL          PARTES              PRAZOS & EVENTOS
  Visão Geral          Partes              Tarefa ...
  Auditoria
```

## Detalhes técnicos
- Arquivo: `src/components/processos/ProcessoDetalhesCompletos.tsx`.
- `navGroups`: remover `{ id: "partes", ... }` de "Monitoramento" e criar o grupo `{ label: "Partes", items: [{ id: "partes", label: "Partes", icon: Users }] }` após o grupo "Visão geral".
- Sidebar desktop (linha ~1027): trocar `max-h-[calc(100vh-112px)]` por altura fixa `h-[calc(100vh-112px)]` no `ScrollArea` (com `sticky top-0`) para o viewport do Radix ter altura e a barra de rolagem funcionar; conferir que o `aside` não impede a rolagem (`overflow-hidden`/`self-start`).
- Sem alterações de dados, permissões ou banco.

## Verificação
Abrir um processo no desktop: "Partes" aparece no topo, logo após Visão Geral, e o menu rola até o último grupo ("Interação"). No mobile, o menu horizontal continua exibindo todos os grupos.
