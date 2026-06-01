## Objetivo

Transformar a geração atual de Carga Benner em um fluxo controlado por **Remessas**, com histórico completo do que foi enviado ao Santander, status, arquivos arquivados, retorno conciliado e envio por e-mail direto do sistema.

## Fluxo (alto nível)

```text
Tela Distribuição TST → filtros aplicados → "Gerar Carga Benner"
        ↓
[Preview da remessa] (qtd, dossiês, planilha gerada)
        ↓
"Confirmar Remessa"  → cria registro em remessas_benner
                     → dossiês passam para status "planilhado"
                     → arquivo XLSX vai para Supabase Storage
        ↓
[Tela da Remessa] → baixar planilha · enviar por e-mail · marcar enviada
        ↓
"Enviar por e-mail" → modal com remetente fixo, destinatários, CC, anexo
                    → envia via edge function + Lovable Emails
                    → status vira "enviada", grava data_envio
        ↓
[Conciliação] Upload da planilha de retorno do Santander
            → marca cada dossiê como aceito / rejeitado / pendente
            → status final da remessa: "conciliada"
```

## Mudanças

### 1. Banco de dados (migração)

**Tabela `remessas_benner`** (cabeçalho da remessa):
- `numero_sequencial` (auto, ex.: REM-2026-0001)
- `data_geracao`, `data_envio`, `data_conciliacao`
- `quantidade_itens`, `quantidade_aceitos`, `quantidade_rejeitados`, `quantidade_pendentes`
- `status`: gerada · enviada · retornada · conciliada · cancelada
- `filtros_aplicados` (jsonb — snapshot dos filtros usados)
- `arquivo_path` (storage), `arquivo_nome`
- `email_destinatarios` (text[]), `email_cc` (text[]), `email_assunto`, `email_corpo`
- `observacoes`, `created_by`, `enviado_por`, `coordenacao_id`

**Tabela `remessas_benner_itens`** (snapshot dos dossiês enviados):
- `remessa_id`, `dado_benner_id`, `dossie`, `processo`, `turma`, `relator`
- `status_retorno`: pendente · aceito · rejeitado
- `motivo_retorno`

**Bucket de Storage**: `cargas-benner-remessas` (privado, signed URLs).

RLS por `coordenacao_id` (padrão do projeto). GRANTs para `authenticated` e `service_role`.

### 2. Lovable Cloud — E-mail

Configurar Lovable Emails (domínio de envio) e usar um **template transacional** "carga-benner-remessa" que anexa link de download (Storage signed URL) da planilha. O e-mail é enviado por edge function `enviar-remessa-benner` que:
- Valida sessão e coordenação
- Lê remessa, gera signed URL do XLSX
- Envia via `send-transactional-email` com destinatários, CC, assunto e corpo configuráveis
- Atualiza `data_envio` e `status = 'enviada'`

Destinatários padrão e remetente ficam em **Configurações → Carga Benner** (`configuracoes_carga_benner`: email_padrao_para, email_padrao_cc).

### 3. Frontend

**`CargaBennerFromDb.tsx`** (ajustes):
- Após gerar a planilha, em vez de só baixar: mostrar botão **"Salvar como Remessa"**.
- Ao confirmar: chamar RPC `criar_remessa_benner(filtros, ids, arquivo_blob)` → upload do XLSX no Storage + insert em `remessas_benner` + `remessas_benner_itens` + UPDATE em massa de `dados_benner.status = 'planilhado'`.

**Nova página `/remessas-benner`** (menu: "Remessas Benner"):
- Tabela: nº, data envio, qtd, status, aceitos/rejeitados, responsável, ações.
- Filtros: status, período, responsável.
- Linha → drawer/detalhe da remessa.

**Página de detalhe da remessa**:
- Cabeçalho (nº, datas, status, contadores).
- Lista dos dossiês da remessa com status de retorno.
- Ações: **Baixar planilha** · **Enviar por e-mail** · **Marcar como enviada (manual)** · **Importar retorno** · **Cancelar remessa**.
- Modal "Enviar por e-mail": destinatários (pré-preenchidos), CC, assunto, corpo (template editável), preview do anexo.
- Modal "Importar retorno": upload XLSX → reconciliação por dossiê → atualiza `status_retorno` e contadores → `status = 'conciliada'`.

### 4. Transições automáticas de status do dossiê

- Confirmar remessa → `dados_benner.status = 'planilhado'`
- E-mail enviado → `dados_benner.status = 'enviado'`
- Retorno aceito → mantém `enviado`; rejeitado → volta para `pronto_envio` com motivo em `notas`.

## Detalhes técnicos

- Numeração: `REM-YYYY-NNNN` via sequence dedicada por ano.
- Snapshot dos filtros: gravar JSON completo para auditoria/repetição.
- XLSX gerado é o mesmo do fluxo atual (`gerarPlanilhaBenner` + JSZip), apenas redirecionado para Storage em vez de download direto (o download fica disponível depois pela tela da remessa).
- Edge function `enviar-remessa-benner` com `verify_jwt = true`, valida coordenação do usuário, usa service-role para signed URL.
- Conciliação: matching por **dossiê normalizado**; relatório de divergências exibido após upload.
- Permissão para cancelar/enviar: usuários da mesma coordenação; admin sempre.

## Entregáveis

1. Migração: tabelas `remessas_benner`, `remessas_benner_itens`, `configuracoes_carga_benner`, sequence, RLS, GRANTs, bucket.
2. Edge functions: `enviar-remessa-benner`, `importar-retorno-benner`.
3. Template transacional `carga-benner-remessa`.
4. UI: ajuste em `CargaBennerFromDb`, nova página `RemessasBenner` (listagem + detalhe + modais).
5. Item de menu na sidebar.

## Fora do escopo (para depois, se quiser)

- Assinatura digital do e-mail / DKIM dedicado.
- Webhook de retorno automático do Santander (hoje só upload manual de planilha).
- Dashboard analítico de SLA de remessas.
