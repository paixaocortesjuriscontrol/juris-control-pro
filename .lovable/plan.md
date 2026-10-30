# Campo "Rito Processual" (JEC x Vara Cível)

## O que muda para o usuário
1. **Ficha do processo** (Processos e Casos), quadro **Órgão / tramitação**: novo campo **Rito Processual**, logo abaixo de "Tipo do processo". A lista começa com **Juizado Especial Cível** e **Vara Cível** e tem a opção **+ Adicionar novo rito**: a pessoa digita o nome e ele passa a aparecer na lista para todos.
2. **Planilha de importação diária**: nova coluna reconhecida **Rito Processual**. "JEC" vira Juizado Especial Cível e "VC" vira Vara Cível (sem diferenciar maiúsculas/acentos); outro nome vira um rito novo na lista. Coluna vazia não apaga o valor já gravado. Sem busca na Judit.
3. **Filtros avançados** da lista de processos: filtro **Rito Processual** com todos os ritos da lista e "Sem rito", para contar quantos casos de cada tipo.
4. O texto de "Colunas reconhecidas" da importação passa a citar a nova coluna.

## Detalhes técnicos
- Migração: tabela `ritos_processuais` (nome único, ativo), já com os dois ritos iniciais; GRANT a authenticated/service_role, RLS: leitura e inclusão para usuários logados, alteração/exclusão só admin (via `has_role`). Coluna `processos.rito_processual text` guardando o nome do rito. Sem mudança nas regras de acesso de processos.
- `ProcessoVisaoGeralForm.tsx`: `rito_processual` nos campos salvos; `Select` com item "+ Adicionar novo rito" que abre um campo de texto, grava em `ritos_processuais` (sem duplicar por nome normalizado) e aplica ao processo.
- `ImportarProcessos.tsx`: ler `row["Rito Processual"]` e normalizar com `normalizarRitoProcessual` em `src/lib/ritoProcessual.ts` (+ testes: "JEC"→Juizado Especial Cível, "vc"→Vara Cível, "Vara Cível"→Vara Cível, vazio→null); ritos novos são incluídos na tabela.
- `FiltrosAvancadosProcessos.tsx` + consulta de `Processos.tsx`: filtro `eq('rito_processual', ...)` / `is null`.
- Registrar a tarefa em `roadmap.md` ao iniciar a implementação.
