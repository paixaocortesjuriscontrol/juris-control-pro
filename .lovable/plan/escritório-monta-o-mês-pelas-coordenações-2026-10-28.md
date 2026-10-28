# Escritório monta o mês pelas coordenações

## O que muda para quem usa
- Ao clicar em **Escritório**, o calendário traz todas as tarefas, prazos, atas, eventos, audiências e parcelamentos do mês das coordenações da pessoa, sem olhar quem é responsável ou envolvido.
- **Administrador e Assistente Jurídico Geral** veem o mês de todas as coordenações, como já acontece hoje.
- Se uma coordenação for escolhida no filtro, aparece só ela.
- O modo **Pessoal** não muda: continua mostrando o que é da pessoa (responsável, co-responsável, envolvida ou criadora).
- Os cartões e o calendário passam a seguir a mesma regra, então os números conferem entre si.

Em outubro de 2026, todas as tarefas, eventos e audiências cadastradas já têm coordenação. Por isso nenhum item do mês some com essa regra.

## Por que fica mais rápido
- No Escritório, a busca deixa de usar a lista de pessoas (41 no caso da Altina) e as consultas extras de co-responsáveis e envolvidos. Fica uma busca simples por coordenação e data, que usa os índices que já existem.
- As partes do calendário passam de 500 para 1.000 itens, como já é para o administrador. O mês da Altina sai em cerca de 5 partes, em vez de 9.

## Detalhes técnicos
- `PainelControle.tsx`, filtros do Escritório:
  - admin ou assistente geral sem coordenação escolhida: `fetchAll`;
  - com uma coordenação escolhida: `coordenacaoIds: [escolhida]` com `strictCoordenacaoIsolation`;
  - demais perfis: `coordenacaoIds: coordenacoesUsuario` com `strictCoordenacaoIsolation`.
  - Nenhum desses casos passa `responsavelIds`. A exceção é Protocolados/Baixados com pessoas escolhidas, que continua como está.
- `useAgendaUnificada.ts`: com escopo de coordenação, as partes usam o tamanho cheio (1.000), igual ao `fetchAll`. A leitura continua em sequência e o indicador de "parte cheia" de cada fonte continua valendo.
- Os cartões (`get_painel_totais`) já contam por coordenação quando recebem `coordenacaoIds`, então não há mudança no banco nem nas permissões de acesso.
- Teste da regra de escopo: assistente com duas coordenações recebe as duas, sem lista de pessoas; assistente geral recebe todas; coordenação escolhida recebe só ela.
- Atualizar no `AGENTS.md` a regra do escopo do Escritório.
