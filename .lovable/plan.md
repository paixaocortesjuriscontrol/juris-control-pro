
## Plano: Suporte a upload de arquivos ZIP com extracao e analise individual

### Objetivo
Permitir que o advogado envie um arquivo `.zip` contendo multiplos documentos. O sistema ira extrair os arquivos internos, fazer upload de cada um individualmente no Storage, registrar cada documento no banco e permitir analise IA de cada um separadamente.

### 1. Instalar dependencia

Adicionar a biblioteca `jszip` para descompactar arquivos ZIP no navegador:
- `jszip` (leve, ~45KB gzipped, roda 100% no client-side)

### 2. Alterar o input de arquivo

No `ProcessoDetalhesCompletos.tsx`, adicionar `.zip` na lista de formatos aceitos:

```
accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.zip"
```

### 3. Modificar `handlePastaFileSelect`

Atualizar a funcao de upload para detectar arquivos ZIP e trata-los de forma especial:

```text
Arquivo selecionado
      |
      v
  E um ZIP?
   /     \
 NAO     SIM
  |        |
Upload   Descompactar com JSZip
normal   Filtrar arquivos validos
  |      (ignorar pastas, __MACOSX, .DS_Store)
  |        |
  |      Para cada arquivo interno:
  |        - Upload no Storage
  |        - Registrar na tabela documentos
  |        - (opcional) Salvar no repositorio
  |        |
  v        v
  Fim    Toast: "X documentos extraidos do ZIP"
```

**Detalhes da extracao:**
- Filtrar apenas extensoes suportadas: `.pdf`, `.doc`, `.docx`, `.txt`, `.jpg`, `.jpeg`, `.png`, `.xlsx`, `.xls`, `.csv`
- Ignorar arquivos de sistema: `__MACOSX/`, `.DS_Store`, `Thumbs.db`
- Ignorar pastas vazias
- Progresso: mostrar barra de progresso geral (ex: "Extraindo 3/7 arquivos...")
- Cada arquivo interno sera registrado como documento individual vinculado ao processo

### 4. Analise IA continua individual

Nenhuma mudanca na funcao `handleAnalyzeDocument`. Cada documento extraido do ZIP aparecera na lista com seu botao "Analisar IA" individual, como ja funciona hoje.

### 5. Arquivos a modificar

- `package.json`: adicionar `jszip`
- `src/components/processos/ProcessoDetalhesCompletos.tsx`:
  - Importar JSZip
  - Adicionar `.zip` ao accept
  - Modificar `handlePastaFileSelect` para detectar e descompactar ZIPs
  - Exibir progresso de extracao (reutilizar barra de progresso existente)

### 6. Limitacoes e seguranca

- Limite de tamanho por arquivo extraido: 300MB (mesmo limite do Storage)
- Limite de arquivos por ZIP: 50 (para evitar ZIP bombs)
- Arquivos duplicados (mesmo nome) receberao timestamp unico no path do Storage
