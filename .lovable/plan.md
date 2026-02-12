
## Plano: Download de Autos via PJe com Certificado A1

### Visão Geral
Implementar funcionalidade para que advogados façam login automaticamente no PJe usando o certificado digital A1 (arquivo `.pfx`/`.p12` armazenado no Supabase Storage) e baixem automaticamente os autos (documentos) dos processos, armazenando os PDFs no Supabase Storage e criando referências no banco de dados.

### Arquitetura de Fluxo
```
[Advogado no ProcessoDetalhes]
    ↓
[Seleciona "Baixar Autos" na aba ProcessoPortalTab]
    ↓
[Sistema valida credencial com A1 no cofre_senhas]
    ↓
[Invoca edge function: baixar-autos-pje]
    ↓
[Browserless + A1 = Login automatizado no PJe]
    ↓
[Scrape de documentos/autos do processo]
    ↓
[Download dos PDFs para Supabase Storage]
    ↓
[Salva referências em tabela: processos_documentos_download]
    ↓
[UI atualiza mostrando documentos obtidos]
```

### Componentes a Serem Implementados

#### 1. **Nova Tabela: `processos_documentos_download`**
- Armazena referência aos documentos baixados
- Campos:
  - `id` (uuid, pk)
  - `processo_id` (uuid, fk → processos)
  - `cofre_senha_id` (uuid, fk → cofre_senhas) - qual credencial foi usada
  - `nome_arquivo` (text) - nome do documento
  - `tipo_documento` (text) - auto, sentença, despacho, etc
  - `storage_path` (text) - caminho no Supabase Storage
  - `tamanho_bytes` (integer)
  - `data_documento` (date, nullable) - data da sentença/auto
  - `status_download` (enum: sucesso|erro|pendente)
  - `mensagem_erro` (text, nullable)
  - `downloaded_at` (timestamp)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

#### 2. **Edge Function: `baixar-autos-pje/index.ts`**

**Entrada:**
```typescript
{
  cofre_senha_id: string;       // ID da credencial com A1
  processo_numero: string;       // Número do processo
  tribunal?: string;            // TRT1, TRT2, TJSP, etc
}
```

**Lógica:**
1. Buscar credencial no `cofre_senhas` incluindo:
   - `login` / `senha_hash`
   - `certificado_a1_path` (arquivo .pfx no Storage)
   - `certificado_a1_senha` (senha do certificado)

2. **Buscar arquivo A1 do Storage:**
   - Usar `supabase.storage.from('cofre_certificados').download(path)`
   - Armazenar em memória como buffer

3. **Autenticar no PJe com A1:**
   - Usar Browserless `/function` endpoint
   - Código Puppeteer injetado que:
     - Carrega o arquivo `.pfx` como certificado do cliente
     - Envia requisição HTTPS com certificado
     - Navega até a página de autenticação
     - Realiza handshake de certificado automaticamente
   - PJe tipicamente NÃO exige password quando usa certificado (apenas aperta "Continuar")

4. **Buscar lista de autos:**
   - Navega até `/primeirograu/processo/{numero}`
   - Scrape da listagem de documentos
   - Detecta links para download (PDFs)
   - Extrai metadata: tipo documento, data, tamanho

5. **Download dos PDFs:**
   - Para cada documento encontrado:
     - Faz requisição HTTPS com certificado para o link do PDF
     - Faz upload para `supabase.storage.from('processos_autos')`
     - Salva referência em `processos_documentos_download`

6. **Retorna status:**
   ```typescript
   {
     sucesso: boolean;
     documentos_baixados: number;
     documentos_total: number;
     documentos: {
       nome: string;
       tipo: string;
       storage_path: string;
       tamanho: number;
       status: 'sucesso' | 'erro';
       erro?: string;
     }[];
   }
   ```

#### 3. **Componente UI: `BaixarAutosButton.tsx`**
- Novo botão na aba `ProcessoPortalTab`
- Estados:
  - Aguardando seleção de credencial com A1
  - Carregando (download em progresso)
  - Sucesso (mostra lista de docs baixados)
  - Erro (mostra mensagem)
- Mostra progresso: "Baixando documento 3 de 7..."
- Ao sucesso, lista documentos com link para abrir/baixar

#### 4. **Hook: `useBaixarAutos.ts`**
- Mutation para invocar edge function
- Gerencia estado de loading/erro
- Refetch automático após sucesso

#### 5. **Atualização: `ProcessoDocumentosTab.tsx`**
- Integrar abas:
  - "Documentos Armazenados" (autos já baixados via A1)
  - "Meus Documentos" (uploads manuais)
  - "Baixar Autos" (busca nova captura)

### Detalhes Técnicos Críticos

#### Autenticação com Certificado A1 via Browserless/Puppeteer

```javascript
// Pseudocódigo - o que roda dentro do Browserless
const https = require('https');
const fs = require('fs');

// Carregar certificado .pfx
const pfxData = Buffer.from(base64CertData, 'base64');
const pfxPassword = 'senha_do_a1';

// Criar agent HTTPS com certificado
const agent = new https.Agent({
  pfx: pfxData,
  passphrase: pfxPassword,
  rejectUnauthorized: false, // PJe usa cert auto-assinado em alguns casos
});

// Usar agent em fetch/axios
const response = await fetch(pjeUrl, {
  method: 'GET',
  agent: agent,
});
```

#### Challenges & Soluções

**1. Arquivo .pfx em memória no Edge Function**
- ✅ Possível: Browserless roda Puppeteer em Node.js
- Solução: Converter arquivo binário para base64, passar como string

**2. Senha do certificado segura**
- ✅ Já armazenada em `cofre_senhas.certificado_a1_senha`
- Solução: Decodificar na edge function (não no cliente)

**3. Timeout para downloads longos**
- ✅ Browserless suporta timeouts até 120s (pode estender)
- Solução: Implementar progresso parcial (salvar docs conforme baixados)

**4. Erro se certificado expirou**
- ✅ Detectar erro de certificado inválido
- Solução: Retornar erro claro ao usuário, sugerir renovação

### Sequência de Implementação

1. **Criar tabela `processos_documentos_download`** via SQL migration
   - Incluir RLS policies (usuário pode ver docs de processos que ele acessa)

2. **Implementar edge function `baixar-autos-pje`**
   - Começar com TRT (trabalhista) - mais simples que TJSP
   - Testar com credencial real ou mock
   - Validar download e armazenamento no Storage

3. **Criar hook `useBaixarAutos`**
   - Mutation que chama a edge function

4. **Criar componente `BaixarAutosButton`**
   - Integrar em `ProcessoPortalTab`
   - Estados de loading/sucesso/erro

5. **Atualizar `ProcessoDocumentosTab`**
   - Listar documentos baixados

6. **Testar end-to-end**
   - Navegar até um processo real (ex: na rota `/processos/d1d04239...`)
   - Selecionar credencial com A1
   - Clicar em "Baixar Autos"
   - Verificar que PDFs aparecem em "Documentos Armazenados"

### Limitações & Fallbacks

- **Se certificado expirou:** Edge function retorna erro, usuário renova certificado no Cofre
- **Se PJe mudou URL/estrutura:** Atualizar seletores no Browserless (manutenção periódica)
- **Se tribunal não suporta certificado:** Fallback para login manual (já existe)
- **Se documento é muito grande (> 50MB):** Avisar usuário, não tentar baixar

### Dados Armazenados

- **Cofre Storage (`cofre_certificados`):** Já existe, armazena `.pfx`
- **Novo Storage (`processos_autos`):** Criar bucket novo para os PDFs baixados
  - RLS policy: usuário pode ver/baixar autos de processos da sua coordenação
  - Reter por 90 dias (limpeza automática via cron)

### Segurança

- ✅ Certificado A1 já encriptado em trânsito (HTTPS)
- ✅ Senha do certificado não transmitida ao navegador (apenas edge function)
- ✅ Logs de acesso: qual usuário baixou quais docs em que data
- ✅ RLS policies garantem acesso apenas a processos permitidos
