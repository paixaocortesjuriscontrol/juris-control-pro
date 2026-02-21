

## Corrigir extracao e exibicao dos dados DJEN: armazenar dados estruturados da API

### Causa raiz do problema

A API do PJE Comunica retorna dados estruturados ricos:
- `nomeOrgao` (ex: "3a Turma")
- `tipoComunicacao` (ex: "Intimacao")  
- `meio` (ex: "D")
- `destinatarios[]` com nome, OAB, UF de cada advogado

Porem, o sistema hoje mistura TUDO dentro do campo texto `conteudo` (via `buildDjenLikeConteudo`), e depois tenta re-extrair esses dados via regex na hora de exibir. Isso e inerentemente fragil e causa as falhas que voce ve (orgao generico, advogados nao detectados, etc.).

**Exemplo real do banco:**
```
Orgao: 3a Turma
Data de disponibilizacao: 2026-02-19
Tipo de comunicacao: Intimacao
Meio: D
Processo: 00002626720185050611

Advogados:
BANCO SANTANDER (BRASIL) S.A.     <-- isso e PARTE, nao advogado!
SINDICATO DOS TRABALHADORES...    <-- isso tambem e PARTE

A C O R D A O ...
```

O sistema injeta "BANCO SANTANDER" como advogado porque a API retornou no campo `destinatarios`, mas na verdade e uma parte. E o regex nao consegue distinguir.

### Solucao: armazenar campos estruturados separadamente

#### 1. Adicionar colunas na tabela `publicacoes_djen`

Novas colunas:
- `orgao` (text) - nome do orgao julgador (ex: "5a Turma", "2a Vara do Trabalho")
- `tipo_comunicacao` (text) - tipo (ex: "Intimacao", "Citacao")
- `meio` (text) - meio de publicacao (ex: "D", "Diario de Justica Eletronico Nacional")
- `advogados_json` (jsonb) - array de objetos `{nome, oab, uf}` extraidos da API

Essas colunas sao preenchidas NO MOMENTO DA CAPTURA, quando os dados estruturados da API ainda estao disponiveis, em vez de tentar re-extrair depois.

#### 2. Preencher os novos campos no momento do salvamento

No `useDjenTermosEngine.ts`, alterar o payload de insercao para incluir:

```text
orgao:             pub.nomeOrgao || pub.orgao || null
tipo_comunicacao:  pub.tipoComunicacao || null
meio:              pub.meio || pub.meioComunicacao || null
advogados_json:    extractAdvogadosFromMeta(pub)  // ja existe essa funcao!
```

A funcao `extractAdvogadosFromMeta` em `djenLikeConteudo.ts` ja extrai advogados dos metadados estruturados da API corretamente. Hoje ela e usada apenas para injetar no texto; agora sera usada para salvar em coluna propria.

#### 3. Atualizar `PublicacaoConteudoDjen.tsx` para usar dados estruturados

O componente recebera as novas props opcionais:
- `orgaoEstruturado` - usado diretamente, sem regex
- `tipoComunicacaoEstruturado` - usado diretamente
- `meioEstruturado` - usado diretamente, com expansao de abreviacoes (D -> Diario de Justica Eletronico Nacional)
- `advogadosJson` - array de advogados ja formatados

Logica: se o campo estruturado existir, usa ele. Senao, faz fallback para regex (publicacoes antigas que nao tem os novos campos).

#### 4. Atualizar layout para formato split igual Comunica PJE

Reestruturar o layout do componente:
- Coluna esquerda fixa/sticky com metadados (orgao, data, tipo, meio, partes, advogados)
- Coluna direita com scroll independente para o conteudo da publicacao
- Divisoria visual clara entre as duas colunas
- Altura controlada via prop `maxHeight`

#### 5. Atualizar `AnaliseDjen.tsx`

- Passar os novos campos estruturados como props para `PublicacaoConteudoDjen`
- Atualizar geracao de PDF para usar os campos estruturados
- Remover `ScrollArea` duplicado do Dialog

### Detalhes tecnicos

**Arquivos a modificar:**
1. **Nova migracao SQL** - adicionar colunas `orgao`, `tipo_comunicacao`, `meio`, `advogados_json` em `publicacoes_djen`
2. **`src/hooks/useDjenTermosEngine.ts`** (~linha 1215) - preencher novos campos no payload de insercao
3. **`src/components/djen/PublicacaoConteudoDjen.tsx`** - aceitar novas props, usar dados estruturados com fallback regex, layout sticky split
4. **`src/pages/AnaliseDjen.tsx`** - passar novos campos como props, corrigir PDFs
5. **`src/integrations/supabase/types.ts`** - atualizar tipos com novas colunas

**Impacto:**
- Publicacoes ja existentes no banco continuarao usando regex (fallback)
- Novas publicacoes capturadas terao os campos estruturados preenchidos automaticamente
- Nenhuma perda de dados ou quebra de funcionalidade existente
