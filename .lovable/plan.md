## Escopo aprovado
- Corrigir motor STF Servidor (`monitor-servidor/engines/stfServidor.js`).
- Validação de `palavra-chave` idêntica à do DJEN Termos Servidor (`monitor-servidor/engines/paralela.js`): frase exata com AND por `+`, **sem** fallback de "todas as palavras separadas".
- Extrair partes e advogados do campo `envolvidos[]` que a API STF entrega.
- Apagar todas as publicações STF (só STF) para reteste limpo.

## Descoberta verificada
A API `https://digital.stf.jus.br/decisoes-publicacoes/api/public/publicacoes` **entrega dados estruturados** no campo `envolvidos[]`:

```json
{
  "nome": "Marcia Phelippe",
  "polo": "ATIVO" | "PASSIVO",
  "categoria": "RECLAMANTE(S) | RECORRENTE(S) | IMPETRANTE(S) | PACIENTE(S) | AUTOR(A/ES) | RÉU(S) | AGRAVANTE(S) | AGRAVADO(S) | ADVOGADO(A/S) | ...",
  "identificacoes": ["OAB 84798/SP"]
}
```

A implementação atual não lê esse campo (procura `parte/partes/destinatarios` que não existem), por isso `partes_json`/`advogados_json` gravam vazio e a validação cai no corpo inteiro da decisão com fallback frouxo — trazendo publicações aleatórias.

## Mudanças em `monitor-servidor/engines/stfServidor.js`

### 1. Nova extração via `envolvidos[]`
- `parseEnvolvidos(pub)` produz `{ partes, advogados, polo_ativo, polo_passivo }`.
- Advogado = `categoria` que começa com `ADVOGADO`/`PROCURADOR`/`DEFENSOR`. Demais = parte.
- OAB é extraída de `identificacoes` por regex `/OAB\s*(\d+)\s*\/?\s*([A-Z]{2})/`.
- `partes_json` grava `"[Categoria] Nome"` (padrão DJEN). `advogados_json` grava `"Nome - OAB UF00000"`.
- `metadataStf` passa a usar `parseEnvolvidos` como fonte primária; regex sobre o texto vira fallback apenas quando `envolvidos` vier vazio.

### 2. Validação por tipo (espelho do paralela.js)
Reescreve `passaValidacao(mon, pub)`:

- **processo** — compara dígitos (inalterado).
- **parte** — frase exata contra `envolvidos[].nome` (categorias de parte). Aceita `+` (AND). Sem fallback no corpo.
- **advogado** — combina:
  - OAB (`mon.oab`+`mon.uf`) contra `identificacoes` dos envolvidos de categoria `ADVOGADO*`;
  - nome (frase exata) contra `nome`;
  - `termos_or` parseados por `parsearTermoOr`.
- **palavra-chave / geral / default** — `contemFraseComAnd` no **texto completo** (conteudo + nomes de partes e advogados de `envolvidos` + relator + tipo), **sem** `fallbackTodasPalavras`. Idêntico ao DJEN.

Exclusões e `condicao_concomitante` continuam avaliadas no texto completo com frase exata (sem fallback).

Remove `contemTodasPalavras` e o parâmetro `fallbackTodasPalavras` de `contemTermoStf`. Nova helper `contemFraseComAnd` copiada de `paralela.js`.

### 3. Motivos de descarte explícitos
`sem_parte_envolvidos`, `sem_advogado_envolvidos`, `oab_divergente`, `sem_match_texto`, `excluido: <termo>`, `sem_concomitante: <termo>`.

## Limpeza antes do reteste
Executar via insert tool, **restrito a STF**:

```sql
DELETE FROM publicacoes_djen_descartadas WHERE fonte = 'stf';
DELETE FROM publicacoes_djen           WHERE fonte = 'stf_digital';
```

Nenhuma publicação DJEN é tocada.

## Fora de escopo
- Motor Browser (`useStfTermosFlashEngine.ts`) — pode ser espelhado depois se quiser.
- Backfill de publicações STF anteriores.

## Arquivos alterados
- `monitor-servidor/engines/stfServidor.js`
