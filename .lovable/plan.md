# Campo "Rito Processual" (JEC x Vara Cível)

## O que muda para o usuário
1. **Ficha do processo** (Processos e Casos), quadro **Órgão / tramitação**: novo campo **Rito Processual**, logo abaixo de "Tipo do processo", com as opções **Juizado Especial Cível** ou **Vara Cível** (ou em branco). Edição direta no campo, como os outros.
2. **Planilha de importação diária**: nova coluna reconhecida **Rito Processual**. Aceita "Juizado Especial Cível", "JEC", "Vara Cível" ou "VC" (sem diferenciar maiúsculas/acentos). Se a coluna vier vazia, o valor já gravado não é apagado. Não há busca na Judit.
3. **Filtros avançados** da lista de processos: novo filtro **Rito Processual** (JEC / Vara Cível / Sem rito), para contar quantos casos de cada tipo.
4. Texto de "Colunas reconhecidas" da importação passa a citar a nova coluna.

## Detalhes técnicos
- Migração: `ALTER TABLE processos ADD COLUMN rito_processual text` com validação por trigger (`jec` | `vara_civel` | null). Sem mudança de RLS (herda as regras atuais de processos).
- `ProcessoVisaoGeralForm.tsx`: incluir `rito_processual` na lista de campos salvos e o `Select` no bloco de tramitação.
- `ImportarProcessos.tsx`: ler `row["Rito Processual"]`, normalizar com função pura `normalizarRitoProcessual` em `src/lib/ritoProcessual.ts` (+ testes: "JEC"→jec, "Vara Cível"→vara_civel, "vc"→vara_civel, valor desconhecido→null).
- `FiltrosAvancadosProcessos.tsx` + consulta de `Processos.tsx`: filtro `eq('rito_processual', ...)` / `is null`.
