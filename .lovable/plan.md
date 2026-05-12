## Problema

O Vite já gera arquivos JS/CSS com hash (ex: `index-ab12cd.js`), então em teoria o navegador sempre baixa a versão nova. O que prende o usuário legado é normalmente:

1. **`index.html` cacheado** pelo navegador/CDN — ele continua apontando para os bundles antigos.
2. **Aba aberta há horas/dias** — o usuário não recarrega, então nem chega a pedir um `index.html` novo.
3. **Service worker antigo** (não é o caso aqui — não temos SW registrado).

Hoje o projeto tem `APP_VERSION` em `src/constants/version.ts` (1.0.8), mas é usado apenas como label visual no Sidebar — não força atualização.

## Plano: detector de nova versão + recarga automática

### 1. Endpoint de versão estático

Criar `public/version.json` (servido sem hash) com o conteúdo:
```json
{ "version": "1.0.9", "buildTime": "2026-05-12T..." }
```

Esse arquivo é gerado automaticamente no build via plugin Vite (lê `APP_VERSION` + timestamp). Como está em `public/`, fica acessível em `/version.json`.

### 2. Headers de cache corretos

Garantir que `index.html` e `version.json` **não** sejam cacheados (ou cache muito curto), enquanto os assets com hash continuam com cache longo. Na hospedagem Lovable isso já é o padrão para `index.html`; só precisamos confirmar o mesmo para `version.json` (adicionar `<meta http-equiv="Cache-Control" content="no-store">` não funciona em JSON, então o ideal é o servidor — se a Lovable cachear, alternativa é versão como query: `/version.json?t=${Date.now()}`).

### 3. Hook `useVersionCheck`

Novo hook que:
- A cada **5 minutos** (e ao voltar o foco da aba via `visibilitychange`), faz `fetch("/version.json?t=" + Date.now())`.
- Compara com o `APP_VERSION` atual em memória.
- Se diferente, mostra um **toast persistente** "Nova versão disponível" com botão **Atualizar agora** que executa `window.location.reload()`.
- Opcional: após X minutos sem clicar, recarrega automaticamente quando a aba estiver ociosa (sem formulários abertos).

### 4. Atualização do versionamento

- A cada deploy relevante, subir `APP_VERSION` em `src/constants/version.ts` (já é a convenção do projeto).
- O plugin Vite copia esse valor para `version.json` no build — não precisa lembrar de atualizar dois lugares.

### 5. (Opcional) Botão manual "Verificar atualização"

Adicionar no menu do usuário/Sidebar um item que dispara o check imediatamente e força reload se houver versão nova — útil para suporte ("peça pro usuário clicar aqui").

## Arquivos afetados

- `vite.config.ts` — plugin que escreve `dist/version.json` no build.
- `src/constants/version.ts` — bump da versão a cada release (já existe).
- `src/hooks/useVersionCheck.ts` — novo.
- `src/App.tsx` — montar o hook na raiz.
- `src/components/layout/Sidebar.tsx` (opcional) — botão "Verificar atualização".

## Pontos a confirmar antes de implementar

1. **Recarga automática vs. apenas avisar?** Recomendo apenas avisar com toast + botão (usuário pode estar no meio de um formulário). Auto-reload só se aba estiver ociosa há X minutos.
2. **Frequência do check** — 5 min é razoável; pode ser 2 min se quiser mais agressivo.
3. **Bump manual da versão** está ok, ou prefere automático (timestamp do build como versão)?