# Análise: processos com "Erro Judit"

7 casos com `problema_judit = true` e `erro_judit = true` marcados pelas advogadas (Lienne 2, Paula 2, Tatiana 1, Kellen 1, Osmar 1).

## Padrões identificados nos comentários

### 1. `recorrente` salvo como string composta "Ativo:.../Passivo:..." (BUG)
- `0001408-40.2024.5.22.0101` (Paula) → `recorrente = "Ativo: MARIA JOANA... / Passivo: BANCO SANTANDER..."`
- `0000418-91.2024.5.09.0010` (Lienne — "Colocou Reclamada no campo do Reclamante") → `recorrente = "Ativo: MARCIA..., BANCO SANTANDER..."`

O campo deveria conter só **Reclamante** / **Reclamada** / **Ambos**. O mapeamento atual despeja o nome bruto quando não consegue resolver o polo.

### 2. Polo Reclamante↔Reclamada trocado (BUG de classificação)
- `0001211-74.2024.5.13.0024` (Lienne — "Judit errou Reclamante")
- `1001367-54.2024.5.02.0023` (Paula — "problema com nome do relator e parte recorrente")

### 3. Relator/Turma padrão "Luiz Philippe Vieira de Mello Filho" / "PRESIDÊNCIA"
Aparece em 4 dos 7 casos. **Não é erro da Judit** — processos ainda em triagem/Vice-Presidência do TST. A Judit devolve o Presidente como ocupante temporário e o sistema persiste como relator final.

## O que vou corrigir

### Código

**`supabase/functions/buscar-judit/index.ts`**
1. **Saneamento de `recorrente`/`parte_recorrente_origem`**: se o valor não casar com `^(Reclamante|Reclamada|Ambos)$`, descartar (não persistir lixo).
2. **Classificação robusta de polo**: comparar nome devolvido pela Judit com `partes_ativas`/`partes_passivas` do lawsuit. Sem match seguro → deixar nulo.
3. **Detectar Vice-Presidência/triagem**: quando órgão for `Presidência`/`Vice-Presidência`/`Gabinete da Presidência` **e** judge for o Presidente do TST, **não preencher** `relator`/`turma` e marcar `situacao_processo = "Em Vice-Presidência (aguardando distribuição)"`.

**`src/components/distribuicao-tst/DistribuicaoTstForm.tsx`**
- Whitelist no auto-save para `recorrente`/`relator`/`turma` recusar valores que violem as regras acima (defesa em profundidade).

### Dados — correção dos 7 registros existentes

Para os 7 IDs:
- Limpar **apenas** `recorrente`, `parte_recorrente_origem`, `relator`, `turma` quando contiverem os padrões inválidos descritos acima.
- **Preservar** `observacao_advogado` inteiro (comentários das advogadas ficam como estão).
- **Manter** `problema_judit = true` e `erro_judit = true` — os processos continuam marcados como "Erro Judit" para revisão da advogada.
- **Não** re-disparar Judit automaticamente — a advogada decide quando reprocessar pelo botão "Forçar atualização".

## Fora do escopo
- 12 registros com `problema_judit=true` e `erro_judit=false` (revisão de matérias, não defeito Judit) ficam intactos.
- Nenhuma alteração de schema.
