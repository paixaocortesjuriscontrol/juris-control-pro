# Por que a Turma não está sendo preenchida

No screenshot, o processo `0010746-27.2024.5.03.0017` foi consultado pelo botão Judit e retornou:
- **Tribunal:** TST ✅
- **Relator:** Ives Gandra da Silva Martins Filho ✅
- **Turma:** vazio ❌

A Judit, para processos no TST, devolve o "court" como `Gabinete do Ministro Fulano`, e não como `4ª Turma`. A função `extrairOrgaoERelator` em `supabase/functions/buscar-judit/index.ts` só preenche `turma` quando o nome do órgão casa com a regex `/(\d+)\s*[ªºa]?\s*turma/i`. Como o nome é "Gabinete do Ministro…", a regex não encontra nada e `turma` fica `null`.

Curiosamente, a outra edge function (`consultar-processo-judit`) já trata esse caso usando `derivarTurmaDoRelator(relator)` do `_shared/extrair-relator.ts`, que mapeia cada Ministro para sua Turma (ex.: Ives Gandra → 4ª Turma). O `buscar-judit` (chamado pelo botão Judit do formulário Benner) **não usa** esse fallback.

# Correção

Em `supabase/functions/buscar-judit/index.ts`:

1. Importar `derivarTurmaDoRelator` de `../_shared/extrair-relator.ts`.
2. Logo após a chamada `const { orgao, relator, turma } = extrairOrgaoERelator(rdSelecionada);`, adicionar:
   ```ts
   let turmaFinal = turma;
   if (!turmaFinal && relator) {
     turmaFinal = derivarTurmaDoRelator(relator);
   }
   ```
3. Usar `turmaFinal` no payload retornado (linha 570, `turma: turma` → `turma: turmaFinal`).

Isso resolve tanto o botão Judit individual no `DadosBennerForm` quanto o lote Judit do `DistribuicaoTst`, pois ambos consomem essa mesma function.

Não é necessária mudança no frontend — a classificação automática (`classificarTurmaDB`) já roda quando `data.turma` chega preenchido.

# Fora do escopo

- Não toca em `consultar-processo-judit` (já trata o caso).
- Não altera o mapeamento Relator→Turma (já está correto e compartilhado).
