
# Plano: Proxy via Edge Function para DJEN Processos

## Diagnóstico do Problema

### Situação Atual (Crítica)
- O código está fazendo fetch direto para `comunicaapi.pje.jus.br` do browser
- A API do PJE Comunica **NÃO permite CORS** de domínios externos
- Todas as requisições retornam: `[PJE Comunica] CORS blocked - retornando resultado vazio`
- Resultado: 100% de "progresso" em segundos, mas **0 publicações encontradas**

### Causa Raiz
O código `pjeComunicaClient.ts` foi alterado para ser "browser-only" para evitar WORKER_LIMIT (546), mas a API PJE Comunica não aceita requisições cross-origin do browser.

### Por que a Edge Function é viável agora
Com a estratégia v6 (grupos OR), temos:
- ~195 grupos (não 13.000 processos individuais)
- ~200-400 requisições totais (não 13.000+)
- Cada requisição é leve (10 processos, 1 página)
- A Edge Function não precisa armazenar nada - apenas fazer proxy

---

## Solução: Proxy Híbrido

### Estratégia
1. Manter a lógica de grupos OR no browser (já implementada)
2. Ao invés de fetch direto, chamar Edge Function `buscar-djen` como proxy
3. A Edge Function faz a requisição para a API e retorna o resultado
4. Processamento e persistência continuam no browser

### Fluxo Proposto

```text
Browser                           Edge Function              API PJE Comunica
   |                                    |                          |
   |-- POST buscar-djen                 |                          |
   |   (query OR: "proc1 OR proc2")     |                          |
   |                                    |-- GET /comunicacao       |
   |                                    |   (texto=proc1 OR proc2) |
   |                                    |<-- JSON response         |
   |<-- JSON response (proxy)           |                          |
   |                                    |                          |
   | [Processar localmente]             |                          |
   | [Salvar no Supabase]               |                          |
```

---

## Arquivos a Modificar

### 1. `src/utils/pjeComunicaClient.ts`

Adicionar fallback para Edge Function quando CORS bloquear:

```typescript
// Quando CORS bloquear, usar Edge Function como proxy
if (corsBlocked) {
  console.log('[PJE Comunica] CORS blocked, usando Edge Function como proxy...');
  
  const { data, error } = await supabase.functions.invoke('buscar-djen', {
    body: {
      tipo: params.tipo,
      palavraChave: params.palavraChave,
      numeroProcesso: params.numeroProcesso,
      siglaTribunal: params.siglaTribunal,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      page: params.page,
      pageSize: params.pageSize,
    },
  });
  
  if (error) throw error;
  return data;
}
```

### 2. `supabase/functions/buscar-djen/index.ts`

Já está funcional! Apenas garantir que:
- Aceita parâmetro `palavraChave` com sintaxe OR
- Retorna resposta leve (já implementado com truncamento)
- pageSize padrão = 50 para grupos OR

### 3. `src/hooks/useMonitorarDjenProcessosBrowser.ts`

Nenhuma alteração necessária - o hook já chama `buscarPjeComunicaNoBrowser` que agora terá fallback.

---

## Mitigação de WORKER_LIMIT (546)

### Por que não vai ter problema agora

| Cenário | Requisições | Risco 546 |
|---------|-------------|-----------|
| Sequencial antigo | 13.000+ | ALTO |
| Estratégia v6 (OR) | ~200-400 | BAIXO |

### Proteções adicionais
1. **pageSize = 50**: Menos páginas por grupo
2. **Delay entre grupos**: 3s padrão configurável
3. **Cache desabilitado**: Sem acúmulo de memória
4. **Timeout 60s**: Requisição travada não acumula

---

## Comparação

| Aspecto | Browser-only (atual) | Proxy Edge (proposto) |
|---------|---------------------|----------------------|
| CORS | Bloqueado (100% falha) | Funciona |
| Velocidade | Nula (0 resultados) | ~20-30 minutos |
| Risco 546 | Zero | Baixo (mitigado) |
| Resultados | 0 publicações | Todas as publicações |

---

## Resumo das Alterações

1. **`pjeComunicaClient.ts`**: Reativar fallback para Edge Function quando CORS bloquear
2. **Testar**: Executar DJEN Processos e verificar que encontra publicações
3. **Monitorar**: Se 546 ocorrer, ajustar delay entre grupos

A implementação mantém a lógica de grupos OR (v6) no browser, usando a Edge Function apenas como "túnel HTTP" para bypass de CORS.
