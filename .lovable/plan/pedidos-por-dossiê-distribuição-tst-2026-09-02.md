# Pedidos por Dossiê (Distribuição TST)

Novo botão **Pedidos por dossiê** ao lado de *Gerar Carga Benner*, que importa a planilha (Dossiê + pedidos separados por `|`), cadastra esses pedidos por dossiê e passa a destacar em verde, no formulário do processo, as matérias que constam na lista do dossiê.

## O que será feito

### 1. Nova tabela de pedidos por dossiê
Tabela `pedidos_por_dossie` com: dossiê, nome do pedido, origem da importação e datas. Um registro por par dossiê + pedido, sem duplicar.
Acesso: leitura para usuários autenticados; inclusão/alteração/remoção para admins e coordenadores.

### 2. Botão e importação
- Botão **Pedidos por dossiê** na mesma linha do *Gerar Carga Benner* (visível para admin/coordenador).
- Diálogo com upload `.xlsx`: coluna A = Dossiê, coluna B = pedidos separados por `|`.
- A planilha enviada tem 492 linhas, 387 dossiês distintos e 241 pedidos distintos.
- Ao importar:
  - os pedidos do dossiê **substituem** o que já estava cadastrado para aquele dossiê (dossiês fora da planilha não são afetados);
  - valores vazios e `0` são ignorados;
  - pedidos que ainda não existem na **lista oficial** são incluídos automaticamente (comparação sem acentos/maiúsculas) — tanto em `materias_pedidos_oficiais` quanto no catálogo usado pela lista de seleção (`materias_benner`), para que apareçam para escolha;
  - resumo final: dossiês processados, vínculos criados, pedidos novos cadastrados.

### 3. Verde nas matérias já selecionadas
No formulário/detalhe da Distribuição TST, carregando os pedidos do dossiê do processo:
- as etiquetas das matérias selecionadas (Reclamante, Banco, Terceiro) que constam na lista do dossiê ficam verdes;
- nas linhas da tabela *Análise por Matéria*, o nome da matéria fica verde;
- matérias selecionadas fora da lista do dossiê mantêm a aparência atual (o aviso "fora lista do Benner" continua igual).

### 4. Verde e prioridade na lista de seleção
Na lista de matérias (`MateriasMultiSelect`):
- as matérias que pertencem ao dossiê do processo aparecem **no topo**, em bloco separado, em verde, com a etiqueta "pedido do dossiê";
- as demais seguem na ordem atual, abaixo;
- quando o processo não tem dossiê válido ou não há pedidos cadastrados, a lista fica exatamente como hoje.

## Detalhes técnicos
- Migração: `public.pedidos_por_dossie` (`id`, `dossie text not null`, `pedido text not null`, `pedido_normalizado text not null`, `origem text`, `created_at`, `updated_at`), índice único (`dossie`, `pedido_normalizado`), índice por `dossie`, GRANTs (`select` para `authenticated`, escrita para `authenticated` conforme política, `all` para `service_role`), RLS + trigger de `updated_at`.
- Novo componente `src/components/distribuicao-tst/PedidosPorDossieDialog.tsx` (leitura via `xlsx`, inserção em lotes de 500, `upsert` com `onConflict`).
- Novo hook `src/hooks/usePedidosPorDossie.ts` (busca por dossiê, `staleTime` de 5 min, retorna `Set` normalizado por `normalizeMateriaNome`).
- `MateriasMultiSelect` recebe prop opcional `pedidosDossie?: Set<string>`; `DistribuicaoTstForm` repassa a partir do dossiê do registro; `MateriasAnaliseList` recebe o mesmo `Set` para colorir as linhas.
- Cores via tokens semânticos existentes (sem `text-green-*` cru).
- Botão adicionado em `src/pages/DistribuicaoTst.tsx`, ao lado de `CargaBennerFromDb`.
