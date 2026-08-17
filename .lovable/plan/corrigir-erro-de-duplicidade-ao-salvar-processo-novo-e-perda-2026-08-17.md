# Corrigir erro de duplicidade ao salvar processo novo (e perda do preenchimento da Judit)

## O que está acontecendo

A tela aberta é a de **criação** de processo (`/processos/novo`), não a de um processo já existente. Nesse modo o botão Salvar sempre faz um **INSERT**.

O número `0766781-06.2024.8.07.0016` **já existe** no banco (1 registro, criado em 30/04/2026, sem coordenação responsável). Como existe um índice único global de número (`processos_numero_uidx`), o INSERT é recusado e o Postgres devolve a mensagem crua `duplicate key value violates unique constraint`.

A perda do preenchimento tem a mesma origem: no modo criação o formulário só vive na memória da tela. Ao trocar para a aba "Pasta" e voltar, nada havia sido gravado ainda, então os campos vieram vazios (segunda imagem) e foi preciso clicar na Judit outra vez.

## O que será feito

1. **Detectar o processo existente antes de salvar (modo criação)**
   - Ao clicar em Salvar, buscar processo pelo número (comparando só os dígitos).
   - Se já existir, em vez de erro exibir um aviso claro com duas ações:
     - **Abrir e completar o processo existente**: navega para o processo já cadastrado e aplica o preenchimento da Judit **somente nos campos vazios** (mesma regra `applyIfEmpty` já usada), preservando o que o advogado tinha digitado; e grava.
     - **Cancelar**: fica na tela para o usuário corrigir o número.

2. **Mensagem de erro amigável**
   - Se ainda assim o banco recusar por duplicidade, mostrar: "Este número de processo já está cadastrado no sistema. Abra o processo existente para completar os dados." em vez do texto técnico do Postgres.

3. **Não perder o preenchimento ao navegar entre as abas**
   - Guardar um rascunho do formulário do modo criação (incluindo o que a Judit trouxe) enquanto a tela de criação estiver aberta, restaurando ao voltar de abas como Pasta/Andamentos.
   - Descartar o rascunho depois que o processo é criado com sucesso ou quando o usuário sai da criação.

## Detalhes técnicos

- `src/components/processos/ProcessoVisaoGeralForm.tsx`
  - `handleSave` (modo `isNovo`): pré-consulta `processos` por dígitos do número antes do INSERT; estado novo para o diálogo/aviso de "número já cadastrado" com a ação de abrir o existente.
  - Tratamento do erro `23505` / `processos_numero_uidx` → mensagem em português.
  - Persistência do rascunho por `sessionStorage` (chave por rota de criação), aplicada no `useEffect` de inicialização do `form` quando `isNovo`.
- Nenhuma mudança de schema: o índice único global de número é mantido.
