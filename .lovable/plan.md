# Tipos de tarefa do Projuris usando os Modelos de títulos

## Resposta: sim, é praticamente a mesma coisa
Os **Modelos de títulos** já fazem o que o tipo de tarefa do Projuris faz: cada coordenação cria os seus, cada modelo tem nome, título, descrição, prioridade e valores padrão que entram sozinhos ao criar o item, e eles já aparecem na criação de tarefas e nas etapas do workflow. Então não criaremos um cadastro novo: os tipos do Projuris viram Modelos de títulos da Coordenação Santander Cível.

## O que vamos fazer
0. **Novo nome: "Modelos de tarefas"** — o nome "Modelos de títulos" passa a ser "Modelos de tarefas" no título da tela, nos seletores da criação de itens, no editor de etapas do workflow, nas mensagens e nos manuais. O endereço antigo da tela continua abrindo, para não quebrar atalhos salvos.
0.1. **Item de menu "Modelos de tarefas"** — hoje a tela não está no menu lateral; ela entra logo abaixo de "Modelos de checklist". Todos veem os modelos da sua coordenação; a tela já abre filtrada na coordenação do usuário.
0.2. **Cada coordenação altera só os seus** — hoje qualquer coordenador consegue alterar modelos de qualquer coordenação. Passa a valer: coordenador e assistente de coordenação só criam, alteram e desativam modelos das coordenações de que fazem parte; admin altera todos. Na tela, os modelos de outras coordenações aparecem só para leitura, sem os botões de alterar.
1. **Importar os tipos do Projuris como Modelos de títulos** — novo quadro em Migração Projuris: você envia `tarefatipo` e `tarefaprazotipo`, e os 212 tipos ativos entram **só na Coordenação Santander Cível**. As demais coordenações seguem criando os seus na tela de Modelos de títulos, como já fazem.
   - Os 198 tipos "TAREFA" viram modelos de Tarefa; os 14 "COMPROMISSO" viram modelos de Evento.
   - Título do modelo = nome do tipo (ex.: "APRESENTAR CÁLCULOS").
   - Rodar de novo pula os já importados; o botão Desfazer retira tudo.
2. **Trazer junto o que o Projuris guarda em cada tipo**, como valores padrão do modelo: prazo padrão e prazo fatal (em dias), hora padrão, forma de contar (dias corridos ou dias úteis pelo CPC; "Prazo inverso" conta para trás a partir da data fatal) e a cor.
3. **Modelos de títulos ganham esses campos novos** para qualquer coordenação usar: "Prazo em dias", "Prazo fatal em dias", "Hora padrão", "Contagem" e "Modelo de checklist". Ao escolher o modelo na criação da tarefa, as datas, a hora e os itens do checklist já vêm preenchidos, e tudo pode ser alterado.
4. **Escolha mais fácil com muitos modelos** — o seletor de modelo na criação da tarefa ganha busca por texto, como na tela do Projuris.
5. **Tarefas já migradas** — passam a mostrar o nome do tipo original do Projuris no título, quando ele estiver vazio.

## O que não muda
- A lista fixa de 19 tipos (Prazo, Defesa, Ata...) continua, para não afetar filtros, contagens, Atas e Ranking.

## Detalhes técnicos
- Sem tabela nova: reutiliza `modelos_titulo_coordenacao`; os novos valores ficam em `padroes` (jsonb): `prazo_dias`, `prazo_fatal_dias`, `hora_padrao`, `contagem` (corridos|uteis|inverso), `cor`, `checklist_modelo_id`, `projuris_cd`. Nenhuma alteração de banco ou permissão.
- `PadroesModeloEditor` e `constants/camposModeloTitulo.ts` recebem os campos; `aplicarPadroesModelo.ts` calcula as datas (reaproveitando a regra de dias úteis/feriados existente) e aplica o checklist.
- `ModeloTituloPicker` vira lista com busca.
- Importador segue o padrão de checklists/marcadores, com auditoria em `migracoes_projuris_itens` (tipo `tarefa_tipo`, chave `projuris:<cdtarefatipo>`).
- Testes: leitura do CSV (212 ativos), mapeamento TAREFA/COMPROMISSO e cálculo de datas por contagem.
