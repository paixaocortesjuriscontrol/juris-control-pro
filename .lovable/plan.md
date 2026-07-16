# Excluir a tela **Buscar DJEN** (`/buscar-djen`)

Tela não utilizada (sem link no menu, apenas via URL/Cmd+K). É o único ponto real que ainda chama `resumir-publicacoes` (Pro) na UI, então remover também elimina esse consumo residual.

## Alterações no código

1. **`src/App.tsx`**
   - Remover `import BuscarDJEN from "./pages/BuscarDJEN";`
   - Remover a rota `<Route path="/buscar-djen" ... />`

2. **`src/pages/BuscarDJEN.tsx`** — deletar o arquivo inteiro (`rm`).

3. **`src/components/admin/InfoSistemaTab.tsx`**
   - Remover a linha 187 (entrada "Buscar DJEN" na lista de telas).
   - Remover a linha 284 (entrada "buscar-djen" na lista de edge functions — obs.: essa listagem faz referência a uma edge function `buscar-djen` que **já não existe** no projeto, é só limpeza da tabela informativa).

4. **Paleta de comandos (Cmd+K)** — se houver entrada apontando para `/buscar-djen`, remover. (Verifico no build; se existir em `CommandPalette` ou similar, ajusto no mesmo commit.)

## O que NÃO vou mexer
- **Edge function `resumir-publicacoes`**: continua sendo referenciada em `AnaliseDjen.tsx` e `AnaliseDjenServidor.tsx` (mesmo com os botões atualmente ocultos por `{false && isAdmin}`). Mantenho para não quebrar caso você reative aqueles botões. Se quiser removê-la também, me diga em uma segunda rodada.
- Utilitários `pjeComunicaClient*` e o shim em `integrations/supabase/client.ts` que menciona a antiga função `buscar-djen` — não têm ligação com a tela.

## Confirmação
Se ok, aplico as remoções e faço um build check para garantir que nenhum import quebrado sobrou.
