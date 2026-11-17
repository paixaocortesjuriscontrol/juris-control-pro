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
- [ ] 2b — reorganizar a janela no padrão enviado (quadro do processo, abas, subatividade)
- [ ] 7 — cores das situações (adiado pelo usuário: não mexer agora)
