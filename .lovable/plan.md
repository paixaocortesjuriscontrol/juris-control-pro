

## Plano: Baixar Documentos via Judit + Botão na tela Dados Benner

### Resumo

Criar uma Edge Function `baixar-autos-judit` que usa a API Judit para listar e baixar documentos (PDFs) de um processo, salvando no Storage e registrando na tabela existente `processos_documentos_download`. Adicionar um botão "Baixar Autos" ao lado do botão Judit no formulário Dados Benner.

### Fluxo

```text
[Botão "Baixar Autos" no form]
       │
       ▼
Edge Function "baixar-autos-judit"
       │
       ├─ 1. GET lawsuits/{cnj} → ler attachments[]
       │     (se vazio, POST requests com response_type="attachments" + polling)
       │
       ├─ 2. Para cada attachment:
       │     GET lawsuits/{cnj}/{instance}/attachments/{attachment_id}
       │     → upload PDF ao bucket "documentos_processos"
       │     → INSERT em processos_documentos_download
       │
       └─ 3. Retorna { documentos_baixados, documentos[] }
```

### Mudanças

**1. Nova Edge Function `baixar-autos-judit`**
- Recebe `{ processo_id, processo_numero }` via POST
- Usa `JUDIT_API_KEY` (já configurada nos secrets)
- Consulta o datalake para obter lista de attachments
- Se attachments vazio, faz request assíncrona (`response_type: "attachments"`) + polling até 90s
- Baixa cada PDF via endpoint de attachments
- Salva no bucket `documentos_processos` com path `{processo_id}/{attachment_name}.pdf`
- Registra na tabela `processos_documentos_download` existente
- Retorna resumo com quantidade e lista de documentos

**2. Atualizar `DadosBennerForm.tsx`**
- Adicionar estado `baixandoAutos` e handler `handleBaixarAutos`
- Novo botão "Baixar Autos" (ícone FileDown, cor blue) ao lado do botão Judit
- Desabilitado se não há `processo` preenchido
- Toast com progresso e resultado

**3. Configuração**
- Adicionar `[functions.baixar-autos-judit]` com `verify_jwt = true` em `config.toml`
- Secret `JUDIT_API_KEY` já existe

### Detalhes técnicos

- O endpoint do datalake `GET /lawsuits/{cnj}` retorna attachments com campos: `step_id`, `attachment_date`, `attachment_name`, `extension`
- O attachment_id para download é o `step_id` do attachment (a confirmar com teste real)
- Instance é extraída do CNJ (dígito 14, ou do campo `instance` do response_data)
- Polling do request assíncrono usa `GET requests.prod.judit.io/requests/{request_id}` a cada 5s
- Deduplicação: antes de baixar, verifica se já existe registro com mesmo `nome_arquivo` + `processo_id` na tabela

