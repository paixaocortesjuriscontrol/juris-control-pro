# Roadmap — pedidos da Isabela (Santander Cível)

- [x] 3 — relatório/correção de tipo, subtipo e título (Agenda Futura, código TAR.)
- [x] 1/4 — datas passadas: criação bloqueia; importações avisam no fim
- [x] 5 — diário marcado como lido só depois de salvar (botões manuais mantidos)
- [x] 6 — workflow: responsáveis, envolvidos e campos por etapa ao iniciar
- [x] 2a — data base visível em tarefa/prazo/ata + prevista/fatal automáticas
  - prazo ganhou o campo "Data base" editável (antes só interno, vindo da publicação)
  - prevista e fatal calculadas em dias úteis com os feriados da coordenação
  - sem prazo cadastrado: prevista e fatal = a própria data base
  - fatal do modelo tem prioridade; as duas continuam editáveis
  - testes em src/lib/datasBase.test.ts (8)
- [x] 2b — reorganizar a janela no padrão enviado (quadro do processo, abas, subatividade)
  - tarefa/ata: quadro do processo primeiro (tipo, coordenação, processo + resumo expansível),
    depois prioridade, título, base, prevista/fatal com hora, local, pessoas, observações,
    anexos, abas, alertas e recorrência
  - prazo: processo, título, base, prazo+data limite, fatal, pessoas, observações, abas,
    alertas e recorrência
  - subatividade já existe na aba "Atividades" (data, responsável, situação, observação)
- [ ] 7 — cores das situações (adiado pelo usuário: não mexer agora)

## Acompanhamento Especial — avisos (pedido de 18/11/2026)
- [x] Lista "Quem recebe os avisos" chega marcada: coordenadores por padrão e as pessoas já escolhidas
- [x] Coordenador pode ser desmarcado para deixar de receber (campo `coordenadores_excluidos_ids`)
