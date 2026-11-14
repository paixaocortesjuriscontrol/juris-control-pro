# Migrar a Agenda Futura do Projuris para o Santander Cível

## O que a planilha tem
- 3.456 atividades (TAR.xxxxx) ligadas a 2.472 processos (PRO.xxxxx), de 110 títulos diferentes.
- Situações: 3.356 pendentes, 33 em execução, 25 canceladas, 19 a confirmar, 13 concluídas com sucesso, 9 em revisão, 1 concluída sem sucesso.
- Campos com "|": Comentários (857 linhas, 328 com textos repetidos), Responsáveis (309 linhas com mais de uma pessoa), Etiquetas (151) e partes do processo.

## Como será a importação
1. Nova opção na tela de Migração Projuris: "Agenda futura (planilha)", só para admin, gravando sempre na Coordenação Santander Cível.
2. Tipo de cada item pelo título (mesma regra já usada no Projuris): audiência só quando o título indicar audiência (UNA, AC, AIJ, Sessão de julgamento etc.); os demais viram prazo ou tarefa.
3. Modelos de tarefa: o título é ligado ao modelo já existente na coordenação com o mesmo nome; se não houver, o título é mantido sem criar modelo novo.
4. Números Projuris gravados: identificador da atividade (TAR.) e do processo (PRO.) ficam salvos e registrados na auditoria da migração, para a futura migração dos CSVs reconhecer e não duplicar.
5. Processo: procura pelo número no sistema; se não existir, cria cadastro básico no Santander Cível (número, partes, pasta física/cliente, órgão, assunto, cliente Banco Santander) com o PRO. gravado. Se existir em outra coordenação, só adiciona o Santander Cível como responsável.
6. Comentários: divididos pelo "|", sem repetir textos iguais, cada um gravado como comentário com autor "Importado Projuris".
7. Responsáveis e etiquetas: divididos pelo "|"; responsáveis ligados pelo nome aos usuários; quem não for encontrado aparece no relatório. Etiquetas criadas na coordenação se não existirem (CAPTURA liga o Acompanhamento Especial).
8. Datas: criação, prevista, fatal e conclusão com horas, no horário de Brasília; situação convertida para a do sistema; "Criada por" e "Concluída por" ficam registrados nas observações do item.
9. Reimportar não duplica (reconhece pelo TAR.); pode ser desfeito por lote.
10. Ao final, relatório Excel: criados por tipo, processos criados/vinculados, pessoas e modelos não encontrados, linhas com problema.

## Detalhes técnicos
- Reaproveita `classificarTipo`, `migracoes_projuris` / `migracoes_projuris_itens` (tipo + chave_externa TAR./PRO.), leitura em Web Worker e gravação em lotes com divisão do lote em erro.
- Itens vão para `tarefas` ou `audiencias_detectadas` conforme o tipo; `modelo_tarefa_id` quando houver modelo; `processos.projuris_*` para o PRO. (conferir coluna existente; se faltar, migração pequena só para adicionar a coluna).
- Testes para divisão por "|", deduplicação de comentários, conversão de situação e classificação de tipo.
