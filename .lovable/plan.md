

## Plano: Corrigir extração de Relator e Turma na buscar-judit

### Problema
A API Judit, ao retornar dados do TST, frequentemente traz `judge: null` e `courts` apenas com o órgão de origem (ex: "CEJUSC-TST"), sem informação de Turma ou Ministro Relator. Os dados de Relator/Turma aparecem apenas nos textos dos andamentos (`steps`).

### Diagnóstico
O crawler da Judit para o TST geralmente coleta apenas a "capa" do processo, que não contém Relator nem Turma. Esses dados ficam em:
- **Relator**: aparece em andamentos como `"CONCLUSOS OS AUTOS PARA DESPACHO (GENÉRICA) A ALEXANDRE GARCIA MULLER"`
- **Turma**: aparece em andamentos como `"Distribuído à 4ª Turma — Min. X"`

### Mudanças

**1. Adicionar `_debug` expandido na resposta (`buscar-judit/index.ts`)**
- Incluir `judge_bruto`, `courts_brutos` e `steps_amostra` (primeiros 8 steps) no objeto `_debug` da resposta
- Permite inspecionar os dados brutos da Judit direto no DevTools do navegador sem precisar de logs do servidor

**2. Melhorar extração via andamentos (`buscar-judit/index.ts` + `_shared/extrair-relator.ts`)**
- Adicionar regex para padrão `CONCLUSOS...A NOME` que captura o nome do magistrado após "A" ou "AO" em andamentos de conclusão
- Regex: `/CONCLUSOS\s+(?:OS\s+AUTOS\s+)?(?:PARA\s+\w+\s+)?(?:\([^)]*\)\s+)?(?:A|AO)\s+([A-ZÁÉÍÓÚÂÊÔÇÃÕ][A-Za-z...]{5,80})/i`
- Varrer TODOS os steps (não só os de distribuição/redistribuição) procurando padrões como `MIN.\s+NOME` e `CONCLUSOS...A NOME`

**3. Manter inferência bidirecional**
- Se encontrar Relator mas não Turma → `derivarTurmaDoRelator()`
- Se encontrar Turma mas não Relator → `derivarRelatorDaTurma()`
- Já existe no código, apenas garantir que roda após a nova extração

**4. Deploy e teste**
- Redeployar a edge function
- Testar com o CNJ `0010067-14.2022.5.15.0033` e verificar o `_debug` na resposta

### Observação importante
Para processos em fase de conciliação (CEJUSC), pode genuinamente não haver Relator/Turma atribuídos ainda — isso é comportamento esperado, não bug. O `_debug` expandido vai confirmar isso caso a caso.

### Detalhes técnicos

**Arquivo**: `supabase/functions/buscar-judit/index.ts`
- Adicionar campos de debug no objeto `_debug` do retorno
- Adicionar segundo passo de extração varrendo todos os `steps` com regex ampliado

**Arquivo**: `supabase/functions/_shared/extrair-relator.ts`
- Adicionar padrão `CONCLUSOS` como fallback na função `extrairOrgaoJulgador()`
- Expandir busca para incluir steps genéricos além de distribuição

