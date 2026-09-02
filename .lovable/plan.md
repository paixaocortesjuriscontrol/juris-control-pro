# "Tem chance de êxito" do Banco não é cobrado como obrigatório

## O que está acontecendo

No processo 0010717-58.2021.5.03.0024 a Parte Recorrente é **Reclamada**, o Tipo de Recurso do Banco está preenchido ("Agravo de Instrumento"), há matéria selecionada — e o campo **Tem chance de êxito** do quadro Recurso Banco está vazio, mas a tela diz "Nenhuma pendência".

Causa confirmada: na lista de campos obrigatórios existe "Tem chance de êxito" para o **Reclamante** e para o **Terceiro**, mas **não existe** a entrada equivalente do **Banco**. Ou seja, esse campo nunca foi validado — por isso ora aparece marcado em vermelho (quando o Reclamante é recorrente), ora passa em branco (quando só a Reclamada é recorrente).

## Correção

Incluir "Tem chance de êxito (Banco)?" na lista de campos obrigatórios do quadro **IV. Recurso do Banco**, cobrado apenas quando a Reclamada/Banco figura como Parte Recorrente — exatamente o mesmo critério já usado para Tipo de Recurso do Banco e Matérias Recurso do Banco.

Efeitos:
- O campo passa a receber asterisco de obrigatório no formulário.
- "Verificar Pendências" e o Relatório de Pendências passam a listar "Tem chance de êxito (Banco)?" quando vazio.
- Processos com a Reclamada recorrente e esse campo em branco deixam de ser considerados "Prontos para enviar".

## Detalhes técnicos

- `src/utils/distribuicaoTstPendencias.ts`: adicionar em `CAMPOS_OBRIGATORIOS`, no bloco do Quadrinho IV, `{ key: "tem_chance_exito_banco", label: "Tem chance de êxito (Banco)?", quadrinho: "IV. Recurso do Banco", requiredWhen: recorrenteEnvolveBanco }`. A chave entra automaticamente em `CHAVES_OBRIGATORIAS` e em `COLUNAS_SELECT_PENDENCIAS`.
- Sem mudanças de schema (a coluna `tem_chance_exito_banco` já existe) e sem alteração na geração da Carga Benner.

## Observação

Nesse processo existem **dois registros** com o mesmo dossiê (07.02.033.0003183964/21): um preenchido e outro totalmente em branco. Se quiser, trato a limpeza desse duplicado em seguida — não faz parte desta correção.
