# Pautas de Julgamento — automação e melhorias

## 1. Acesso só da Coordenação Dra. Renata Oficial
- O menu "Pautas de Julgamento" aparece só para membros dessa coordenação (e admin).
- Quem não é da coordenação e abrir o endereço vê "Sem acesso".

## 2. Carga diária automática
- Ao terminar o DJEN Termos Servidor, o sistema faz sozinho o mesmo que o botão **Docs TST**: separa as publicações da coordenação que são **PAUTA** (mesma regra de hoje, sem IA e sem custo).
- Cada pauta vira uma linha na tela, com número do processo, data e horário do julgamento, órgão/turma, relator e modalidade lidos do texto. O que já estiver na Distribuição TST (dossiê, equipe, partes, matérias, chance de êxito) é preenchido automaticamente.
- Não repete: mesmo processo + mesma data de julgamento não entra duas vezes.
- Entram marcadas como **"Nova — a avaliar"**, para a equipe revisar.

## 3. Semana criada sozinha
- Toda segunda-feira (ou na primeira pauta que chegar da semana) a semana nova aparece na lista, no padrão "N. dd.mm a dd.mm", em ordem da mais nova para a mais antiga.
- Corrige a lista atual, que hoje mistura "Semana de 05/10/2026" com as semanas antigas e para na 13.

## 4. Filtros melhores
- Busca por processo, dossiê, reclamante ou reclamada.
- Filtros por relator, órgão/turma, modalidade (virtual/presencial), decisão, advogado, responsável, situação ("a avaliar", "avaliada") e período de julgamento, além da semana.
- Botão "Limpar filtros".

## 5. Responsáveis
- Cada pauta pode ter um ou mais responsáveis da coordenação, escolhidos na linha da lista ou no formulário.
- Seleção em lote: marcar várias pautas e atribuir responsável de uma vez.

## 6. Importar para Processos e Casos + Judit
- Botão **"Importar processo"** na pauta (e em lote): se o processo não existir em Processos e Casos, cadastra na Coordenação Dra. Renata Oficial e consulta a Judit para preencher os campos.
- Se já existir, apenas liga a pauta à ficha, sem nova consulta à Judit (sem custo).
- Ícone na lista mostra se o processo já está cadastrado.

## 7. Detalhe da pauta
- Botão **Voltar** no alto do detalhe, retornando à lista com a mesma semana e filtros.
- Formulário no mesmo estilo da ficha de Processos e Casos: cabeçalho com número do processo e situação, seções em cartões com títulos em caixa alta, edição direta no campo (sem botão "Editar"), salvando ao sair do campo.

## Detalhes técnicos
- `pautas_tst`: novas colunas `status_avaliacao` (texto, padrão 'avaliada' para o histórico, 'a_avaliar' para as automáticas), `origem` ('planilha'|'djen_auto'|'manual'), `publicacao_djen_id`; nova tabela `pautas_tst_responsaveis` (pauta_id, user_id) com GRANTs e RLS por membros da coordenação.
- Edge function `gerar-pautas-tst-auto`: reutiliza a regra de `classificarPublicacaoTst.ts` (copiada para `_shared`), extrai campos por regex, faz upsert pelo índice único (dígitos + data_julgamento), `semana_inicio` = segunda-feira da data de julgamento. Chamada ao fim do job DJEN Termos Servidor (`monitor-servidor`) e também por botão "Buscar pautas agora".
- Lista de semanas: gerada pelas datas distintas de `semana_inicio` + semana atual, nome calculado pela numeração sequencial do ano.
- Importar processo: insere em `processos` com coordenação Renata e chama `consultar-processo-judit` existente.
- Menu: `restrictedCoordenacoes: ["Coordenação Dra. Renata Oficial"]` em `menuItems.ts` e checagem na página.
- Formulário reescrito em `PautasTstForm.tsx` com o padrão visual de `ProcessoVisaoGeralForm.tsx`.
