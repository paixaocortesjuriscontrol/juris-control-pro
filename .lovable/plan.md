# Análise do perfil da Lis Ribeiro e correção definitiva

## O que encontrei
Cadastro da Lis (conferido no banco):
- Perfil geral: **Advogado**.
- Cargo na Coordenação Santander Cível: **Coordenador** (única coordenação).
- **Sem coordenação padrão** definida.
- E-mail de notificações do perfil **desligado**.
- Nenhuma permissão individual de menu ou de agendamento (correto).

**Causa principal dos problemas repetidos:** o sistema tem dois jeitos de saber se alguém é coordenador. Parte das telas olha o **cargo na coordenação** (ali a Lis é coordenadora) e outras olham só o **perfil geral** (ali ela é advogada). Cerca de 22 telas e botões só olham o perfil geral, por exemplo: Minha Agenda, Central de Delegação, Indicadores, Auditoria de itens, Baixa rápida, barra de baixa de ocorrência, Modelos de tarefas, Monitoramento, botões de cancelar itens, etiquetas de processo, menu lateral e telas protegidas para coordenador. Nessas telas ela é tratada como advogada. Isso explica o Remanejar e os campos vazios: cada correção resolveu uma tela, e as outras continuam com a regra antiga.

Outros coordenadores com perfil geral diferente de Coordenador também têm o mesmo problema.

A falta de coordenação padrão faz algumas telas abrirem com o campo Coordenação vazio.

## O que vou fazer
1. **Regra única de coordenador:** a pessoa será tratada como coordenadora quando o perfil geral **ou** o cargo em alguma coordenação for Coordenador ou Assistente de Coordenador. A regra vale em todas as telas acima. Ver todas as coordenações continua limitado ao perfil geral. Nas demais funções, a liberação vale só nas coordenações em que a pessoa tem esse cargo.
2. **Coordenação padrão:** quando a pessoa pertence a uma só coordenação, as telas usam essa coordenação automaticamente. Vou definir Santander Cível como padrão da Lis.
3. **Relatório:** gerar uma lista das pessoas cujo cargo na coordenação não bate com o perfil geral, para você conferir. Não vou alterar o perfil geral de ninguém.
4. O e-mail desligado no perfil da Lis fica como está. Ela mesma pode ligar, ou eu ligo se você pedir.

## Detalhes técnicos
- `useUserRole` passa a também ler `membros_coordenacao.cargo` (normalizado com `normalizarCargoCanonico`) e expõe `isCoordinator`/`isAdminOrCoordinator` e `coordenacoesGeridas`. `podeVerTodasCoordenacoes` não muda.
- Trocar checagens diretas `role === "coordenador"` (Indicadores, AuditoriaItens, BaixaRapidaDialog, BaixaOcorrenciaBar, permissoesPainel) pelo hook.
- RLS e triggers não mudam (o banco já usa o cargo da coordenação).
- Testes unitários: perfil Advogado + cargo Coordenador → coordenador; perfil Advogado sem cargo → não.
- Ajuste de dados: `profiles.coordenacao_padrao_id` da Lis = Santander Cível.
