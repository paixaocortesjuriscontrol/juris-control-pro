# Reorganização das coordenações GOL (pedido da Dra. Beatriz Anjos)

## 1. Dr. Davis em coordenação própria
- O Dr. Davis já é Coordenador da "Coordenação GOL - Norte e Nordeste", junto com Ana Clara Infante e Cecília Palhano. Nada muda nela agora. Os novos membros e os cargos serão incluídos quando ele indicar.

## 2. Execução GOL - Dra B. Anjos (cargos finais)
- Coordenadora: Beatriz Anjos
- Assistentes: Lavínia Rodrigues, Gabrielly Garcias
- Estagiários: Sarah Campos, Suelen Rocha, Alice Campos, Luis Souza
- Assistente Coordenador (leitura do DJ): Bruna Sousa
- Coordenadores, para acompanhamento: Carlos Elias, Gisele Santos, Beatriz Costa
- Ficam para redirecionar prazos que não sejam de execução: Davis Costa e Fernanda Sousa (advogados) e Emilly Rodrigues (assistente)
- Todos já fazem parte desta coordenação, então só os cargos são conferidos.

## 3. Coordenação GOL (cargos finais)
- Assistente Coordenador: Emilly Rodrigues
- Advogada/Coordenadora: Fernanda Sousa, que passa de "advogado" para "coordenador"
- Advogados: Phelipe Sampaio, Saulo Leal, Maria Luiza Vieira
- Assistente: Daiane Souza
- Assistente Coordenador (leitura do DJ): Bruna Sousa
- Coordenadores, para acompanhamento: Carlos Elias, Gisele Santos, Beatriz Costa
- Fica para redirecionar prazos que não sejam de conhecimento: Beatriz Anjos (advogado)

## 4. Redirecionar e depois retirar das coordenações GOL
Para cada pessoa, os processos (como responsável) e os itens em aberto do Painel passam para quem foi indicado. Depois, a pessoa é retirada das duas coordenações GOL.

| Sai | Recebe | Processos | Itens em aberto |
|---|---|---|---|
| Victórya Gadelha | Emilly Rodrigues | 132 | 18 |
| Ana Luiza Ribeiro | Emilly Rodrigues | 0 | 0 |
| Talles Caetano | Beatriz Anjos | 9 | 0 |
| Davis Costa | Beatriz Anjos | 9 | 0 |
| Isabela Ribeiro | Beatriz Anjos | 439 | 2 |

- Itens já concluídos ficam como estão, para manter o histórico.
- Os acessos não são apagados: a Isabela tem coordenação própria e o Davis tem a Norte e Nordeste. Só a participação deles nas coordenações GOL é retirada.
- **Ponto a confirmar:** pela lista do item 2, o Davis deveria permanecer na Execução GOL para redirecionar prazos, mas o item 4 pede a retirada dele. Na proposta, os 9 processos dele passam para a Beatriz Anjos e ele é retirado só da Coordenação GOL, continuando na Execução GOL.

## 5. Conferência final
Lista dos membros e cargos de cada coordenação e contagem de processos e itens transferidos.

## Detalhes técnicos
- Coordenação GOL: f5a0ac48-…; Execução GOL: 408d691a-…; Norte e Nordeste: b7aba3d4-….
- Atualizações de dados: `membros_coordenacao.cargo`, troca de `usuario_id` em `processos_responsaveis` e `tarefa_responsaveis` (sem duplicar quando quem recebe já está no item), ajuste de `tarefas.responsavel_id` nos itens em aberto, e exclusão das linhas de `membros_coordenacao`.
- Sem mudança de estrutura no banco.
