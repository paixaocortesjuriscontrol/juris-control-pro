## Objetivo

Corrigir o comparador/pipeline DJEN Servidor com uma regra simples:

1. A mesma publicação pode aparecer em coordenações diferentes.
2. Dentro da mesma coordenação, se a publicação já foi encontrada por qualquer termo, ela é duplicada e deve contar/gravar apenas uma vez.
3. Uma coordenação nunca interfere na outra.
4. Não tornar `id_djen` obrigatório: quando for nulo, usar a chave de deduplicação existente (`dedup_conteudo_key` ou fallback atual).

## Correção

### 1. Ajustar a deduplicação do comparador

No comparador, trocar a chave para ser sempre isolada por coordenação:

```text
coordenação + id_djen, quando id_djen existir
coordenação + dedup_conteudo_key, quando id_djen for nulo
coordenação + processo/data/hash, fallback legado
```

Isso garante:
- mesma publicação em coordenações diferentes conta para cada coordenação;
- mesma publicação encontrada por vários termos dentro da mesma coordenação conta uma vez só;
- `id_djen` nulo não quebra nada.

### 2. Ajustar a gravação do DJEN Servidor

No ponto onde o servidor grava em `publicacoes_djen_servidor`, antes de inserir:

- agrupar resultados por coordenação;
- dentro de cada coordenação, deduplicar pela chave acima;
- gravar somente uma linha por publicação dentro daquela coordenação;
- se houver vários termos/monitoramentos que encontraram a mesma publicação, manter um `monitoramento_id` representativo, sem multiplicar linhas.

### 3. Não criar regra global entre coordenações

Não será criado bloqueio global por `id_djen`.

O sistema deve permitir:

```text
Coordenação A + id_djen 123 = permitido
Coordenação B + id_djen 123 = permitido
Coordenação A + id_djen 123 novamente = duplicado
```

### 4. Limpar/ignorar duplicados atuais no relatório

Para a análise atual, o comparador deve ignorar duplicados já existentes dentro da mesma coordenação, sem apagar dados automaticamente.

Depois disso, se necessário, podemos fazer uma limpeza controlada dos duplicados históricos, mas não é obrigatório para corrigir a tela.

## Resultado esperado

O comparador DJEN Servidor x Browser passa a mostrar o total correto por coordenação:

- servidor pode continuar maior que browser quando ele encontrou a mesma publicação em coordenações diferentes;
- mas não deve inflar os números por múltiplos termos/monitoramentos dentro da mesma coordenação;
- coordenações permanecem totalmente isoladas.