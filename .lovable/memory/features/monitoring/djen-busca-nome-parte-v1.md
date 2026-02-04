# Memory: features/monitoring/djen-busca-nome-parte-v1
Updated: 04/02/2026

## Tipo de Monitoramento "Polo Passivo ou Ativo"

O sistema DJEN agora suporta um tipo dedicado `'parte'` para buscar publicações onde uma empresa/pessoa aparece como polo ativo ou passivo no processo.

### Motivação:
A versão anterior usava um checkbox `buscar_parte` que causava **dupla requisição por tribunal** (uma busca normal + uma busca adicional por nome de parte), gerando rate limit (HTTP 429). 

A nova implementação usa um tipo separado com uma única passada por tribunal.

### API PJE Comunica:
A busca por nome de parte usa o parâmetro `nomeParte` na API:
```
https://comunica.pje.jus.br/consulta?siglaTribunal=TJRJ&dataDisponibilizacaoInicio=2026-02-03&dataDisponibilizacaoFim=2026-02-04&nomeParte=UNIAO%20QUIMICA%20FARMACEUTICA%20NACIONAL%20S%20A
```

### Implementação:

1. **Banco de Dados**: 
   - Tipo `'parte'` no campo `tipo` da tabela `monitoramentos_djen`
   - Coluna `buscar_parte` **DESCONTINUADA** (não mais usada)

2. **Dialog de Cadastro** (`MonitoramentoDialog.tsx`):
   - Novo tipo "Polo passivo ou ativo" no Select
   - Campo obrigatório: "Nome da Parte"
   - Sem OAB, sem UF
   - Aceita tribunais opcionalmente
   - Busca exata (sem variantes)

3. **Cliente PJE** (`pjeComunicaClient.ts`):
   - Tipo `'parte'` adicionado ao `PjeSearchType`
   - Parâmetro `nomeParte?: string` na interface
   - Constrói query string com `nomeParte` quando `tipo === 'parte'`

4. **Engine de Busca** (`useDjenTermosEngine.ts`):
   - Quando `tipo === 'parte'`, usa `nomeParte` diretamente
   - Sem variantes de busca (busca exata)
   - **Removido** o bloco duplicado de `buscar_parte`

5. **Edge Function** (`buscar-pje/index.ts`):
   - Tipo `'parte'` suportado
   - Valida `nomeParte` quando `tipo === 'parte'`
   - Constrói URL com parâmetro `nomeParte`

### Fluxo:
```
1. Usuário cria monitoramento tipo "Polo passivo ou ativo"
   → Nome: "UNIAO QUIMICA FARMACEUTICA NACIONAL S A"
   → Tribunais: TJRJ, TJSP (opcional)

2. Engine processa com tipo='parte'
   → Busca: nomeParte="UNIAO QUIMICA FARMACEUTICA NACIONAL S A"
   → 1 requisição por tribunal (sem duplicação)

3. Validação de conteúdo
   → Exige frase exata do nome no conteúdo

4. Publicações válidas são salvas normalmente
```

### Características:
- **Única passada**: Não duplica requisições como a versão anterior
- **Sem rate limit**: Evita HTTP 429 em execuções com muitos termos
- **Explícito**: Tipo dedicado claro na UI
- **Retrocompatível**: Monitoramentos antigos com `buscar_parte=true` continuam funcionando (legado)
