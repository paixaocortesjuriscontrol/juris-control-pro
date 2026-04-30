## Objetivo

Permitir ao usuário escolher se a consulta Judit deve incluir os anexos (documentos/peças do processo). Como a consulta com anexos é significativamente mais cara no plano Judit, o padrão será **sem anexos**.

## O que muda na UI

No componente `src/components/benner/DadosBennerPartesTab.tsx`, ao lado do botão **"Buscar Judit"**:

- Adicionar um `Checkbox` rotulado **"Com anexos"** (padrão: desmarcado).
- Tooltip/legenda discreta: *"Consulta mais cara. Inclui lista de documentos do processo."*
- O estado fica em `useState<boolean>(false)`.
- Quando o usuário clicar em "Buscar Judit", o valor do checkbox é enviado no body da invocação da função: `{ numero_processo, tribunal, com_anexos: true|false }`.

Layout sugerido (mesma linha do botão):

```text
[ Buscar Judit ]  [☐] Com anexos    [ + Adicionar Manual ]   N parte(s)
```

## O que muda na Edge Function `supabase/functions/buscar-judit/index.ts`

Hoje a função sempre dispara o crawler com `response_type: "lawsuit"` (sem anexos). Vamos:

1. Ler `com_anexos: boolean` do body (default `false`).
2. Em `juditCriarRequest`, passar `response_type` dinamicamente:
   - `false` → `"lawsuit"` (comportamento atual, mais barato)
   - `true`  → `"lawsuit_with_attachments"` (inclui lista de attachments por step)
3. Quando `com_anexos = true`, repassar a lista de attachments no retorno (`attachments: [...]` agregados de `rd.steps[].attachments`) para futuro uso. Nada mais muda na lógica de extração de partes/relator/turma/situação/tipo de recurso.
4. Logar no console qual modo foi usado para auditoria de custo.

## Comportamento padrão

- Botão clicado sem marcar o checkbox → consulta barata (igual a hoje).
- Botão clicado com checkbox marcado → consulta cara, traz anexos.
- O estado do checkbox **não persiste** entre aberturas — sempre volta a desmarcado, evitando que o usuário ative por engano em consultas futuras.

## Arquivos afetados

- `src/components/benner/DadosBennerPartesTab.tsx` — adicionar checkbox e enviar `com_anexos`.
- `supabase/functions/buscar-judit/index.ts` — aceitar `com_anexos` e ajustar `response_type` no `POST /requests`.

## Fora de escopo

- Não vamos mexer no botão **"Baixar Autos"** (`baixar-autos-judit`), que já é uma operação separada de download de PDFs.
- Não vamos persistir os anexos retornados — apenas devolvê-los no JSON da resposta (uso futuro).
