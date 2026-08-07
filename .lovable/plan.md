# Análise DJEN — correções apontadas pela advogada

## 1. "Salvar e ler" não tira a publicação de "Não lidas"

Causa confirmada: as duas rotinas agrupam publicações por chaves diferentes.

- A lista unificada (`get_djen_publicacoes_unificadas`) agrupa por `compute_djen_conteudo_dedup_key(...)` e só usa o `id_djen` se essa chave for nula. A leitura vale para o grupo inteiro.
- O "Salvar e ler" usa `get_publicacoes_relacionadas_por_dedup`, que agrupa pelo `id_djen` primeiro e só depois pela chave legada.

Quando as publicações irmãs têm `id_djen` diferentes mas o mesmo conteúdo, o "Salvar e ler" grava a leitura em apenas parte do grupo. A lista então escolhe como representante uma irmã sem leitura e o item volta para "Não lidas".

Correção: alinhar `get_publicacoes_relacionadas_por_dedup` à mesma chave da lista (conteúdo primeiro, `id_djen` como reserva) e passar a exibir erro em toast quando a gravação da leitura falhar (hoje só vai para o console).

## 2. Data base com a data errada

O formulário inicia a Data base sempre com a data de hoje. Passa a iniciar com a data da publicação (disponibilização e, na falta dela, publicação), mantendo o campo editável. Vale para Tarefa, Prazo, Evento e Audiência abertos a partir de uma publicação.

## 3. Coordenadores sempre como envolvidos

A regra no banco já existe e adiciona as coordenadoras/assistentes como envolvidas — mas só quando o item é gravado com coordenação preenchida. Nos formulários abertos pela publicação a coordenação vem em branco ("Selecione a coordenação"), então nada é adicionado.

Correção: pré-selecionar a coordenação da publicação (ou a do usuário) no formulário e, no salvamento, garantir os coordenadores como envolvidos sem duplicar e sem substituir os responsáveis. Quem cria já sendo coordenador não entra duas vezes.

## 4. Etiquetas de cliente na base e automáticas

A automação já está implementada no banco, mas nenhuma das 17 etiquetas cadastradas tem cliente vinculado, então ela nunca dispara.

- Na tela de Etiquetas, adicionar o campo "Cliente" na etiqueta (opcional).
- Botão "Aplicar na base" por etiqueta: mostra primeiro a prévia com a contagem de processos que serão marcados e só grava após confirmação.
- Com o cliente vinculado, a aplicação automática passa a valer para publicações novas: processo e publicação recebem a etiqueta sozinhos.

## 5. "Desfazer último"

Já existe na Análise DJEN (desfaz leitura, descarte ou criação de item da sessão). Será apenas revisado junto com o item 1, para que a reversão da leitura alcance o mesmo grupo corrigido.

## Detalhes técnicos

- Migração: recriar `get_publicacoes_relacionadas_por_dedup` usando `COALESCE(compute_djen_conteudo_dedup_key(...), id_djen, legacy)`, idêntica à chave de `get_djen_publicacoes_unificadas`, nas três origens (termo, processo, descartada).
- `src/pages/AnaliseDjen.tsx`: `markPubComoLida` passa a exibir erro de update/upsert em toast e a reverter o estado otimista em falha.
- `src/components/delegacao/NovaTarefaDialog.tsx`, `PrazoDialog.tsx`, `EventoDialog.tsx`, `AudienciaFormSimplificado.tsx`: Data base inicial derivada de `publicacao.data_disponibilizacao ?? publicacao.data_publicacao`; coordenação pré-selecionada a partir da publicação.
- Envolvidos: reaproveitar `coordenadores_da_coordenacao` / `useCoordenadoresDaCoordenacao` no salvamento, com o `ON CONFLICT DO NOTHING` já existente nas tabelas de envolvidos.
- Etiquetas: `etiquetas.cliente_id` já existe; expor no formulário de etiqueta e chamar a função de aplicação em modo prévia antes da execução real.

## Sequência

1. Correção da leitura (item 1) — maior impacto.
2. Data base e coordenadores envolvidos (itens 2 e 3).
3. Etiqueta por cliente: campo, aplicação retroativa e automação (item 4).