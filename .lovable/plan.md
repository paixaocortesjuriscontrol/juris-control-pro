

# Corrigir verificação de Trânsito em Julgado - Consultar TRTs

## Problema
A função `verificar-transito-julgado` consulta **apenas o TST**. Dos 2.108 processos, a maioria pertence a TRTs regionais (TRT2: 546, TRT15: 492, TRT4: 227...) e nunca chegam ao TST. Resultado: apenas 21 detectados como trânsito.

## Solução

### 1. Alterar `getEndpoints()` para incluir o TRT de origem
Extrair o número do TRT das posições 15-16 do número do processo (já existe a função `getTRTFromProcesso` no código mas não é usada) e consultar **TST + TRT regional**. Isso cobrirá processos que transitaram na instância regional.

### 2. Manter a lógica de detecção atual + reforçar busca textual
- Código 848 como indicador (quando acompanhado de texto "trânsito")
- Busca textual por "trânsito em julgado" nos campos `nome`, `descricao` e `complementosTabelados`
- Códigos 22 (Baixa Definitiva) e 246 (Arquivamento) como indicadores secundários quando combinados com texto relevante

### 3. Reduzir batch para evitar timeouts
Com 2 endpoints por processo (TST + TRT), reduzir o batch de 3 para 2 processos simultâneos, e adicionar delay entre requests.

## Arquivo alterado
- `supabase/functions/verificar-transito-julgado/index.ts`: alterar `getEndpoints()` para usar `getTRTFromProcesso()` e retornar `[TST, TRT{N}]`

## Impacto esperado
A cobertura deve subir significativamente, pois a maioria dos trânsitos em julgado ocorre no TRT, não no TST.

