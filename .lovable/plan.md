# Remanejar para quem é Controladoria dentro da coordenação

## Causa (confirmada)
A Geovana Farias tem perfil geral **Advogado(a)**. "Controladoria" é o **cargo dela dentro da coordenação**. A liberação de hoje olhou só o perfil geral, então o botão Remanejar não aparece para ela. O mesmo vale para a Geovana Araújo, que também é Controladoria na coordenação.

## O que muda
1. **Botão Remanejar no Painel:** aparece também para quem tem o cargo Controladoria (ou Coordenador / Assistente de coordenador) em alguma coordenação, além dos perfis gerais já liberados.
2. **Permissão de gravar:** as regras de hoje que deixam a Controladoria alterar eventos e audiências de outras pessoas passam a aceitar também quem é Controladoria dentro da coordenação do item, e não só o perfil geral.
3. Tarefas e prazos já são gravados por quem acessa o processo. Não muda nada.
4. As regras de agendamento da coordenação ("só mudar situação") continuam valendo.

## Detalhes técnicos
- `podeRemanejarNoPainel(role, cargosCoordenacao)`: aceita cargos `controladoria`, `coordenador` e `assistente_coordenador`, normalizados (minúsculas, sem acento, espaço vira `_`). Cargos lidos de `membros_coordenacao` do usuário. Atualizar o teste `permissoesPainel.test.ts`.
- Migração: substituir as políticas "Controladoria remaneja eventos acessiveis" e "Controladoria remaneja audiencias acessiveis" para aceitar `has_role(...,'controladoria')` OU um membro com cargo controladoria na `coordenacao_id` do item.
