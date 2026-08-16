# Corrigir duplicatas no "Resumo DOC sem repetição"

## O que o documento mostra

Sim, o documento enviado tem publicações repetidas. São 41 itens, dos quais 6 são cópias da **mesma comunicação** (mesmo processo, mesma data, mesmo teor, mesmo ID do documento), variando apenas o nome no bloco "Intimado(s) / Citado(s)" e a ordem dos advogados:

- 18 e 19 — 0000094-62.2022.5.05.0017
- 22 e 23 — 1001198-74.2022.5.02.0205
- 24 e 25 — 0011534-36.2017.5.03.0001
- 26 e 27 — 0100965-57.2022.5.01.0035
- 28 e 29 — 0100524-20.2020.5.01.0044

Ou seja, o documento deveria ter 36 itens em vez de 41.

## Causa confirmada

O filtro "sem repetição" tenta ignorar o bloco final de destinatários antes de comparar, mas a função que corta esse bloco só reconhece formatos como `Intimado(s):`. O DJEN grava `Intimado(s) / Citado(s)` (com "/ Citado(s)" no meio e sem dois-pontos), então o corte não acontece, o nome do intimado permanece no texto comparado e as duas cópias viram registros "diferentes".

Verificado no banco: as duas linhas do processo 0000094-62.2022.5.05.0017 (14/08) têm o mesmo teor e o mesmo `INTIMAÇÃO ID e197b26`, diferindo só no intimado, com `id_djen` distintos (695441174 e 695441063).

Agravante secundário: a chave de comparação usa apenas os primeiros 400 caracteres normalizados. Em publicações curtas (~430 chars) o nome do intimado entra nesse recorte, o que também quebra a deduplicação.

## Correção proposta

1. **Reconhecer todos os formatos de bloco de destinatários** na função de corte (`stripDestinatarios`): aceitar `Intimado(s) / Citado(s)`, `Citado(s)`, `Destinatário(s)`, `Advogado(s)`, com ou sem dois-pontos, com ou sem acento, e listas separadas por barra.
2. **Tornar a chave de deduplicação estável**: comparar o teor completo normalizado após o corte (não só 400 caracteres) e, quando existir, usar também o identificador do documento presente no texto (padrão `ID <hash>`) junto com processo + data de publicação.
3. **Ignorar a ordem de advogados/partes** na comparação, já que a mesma comunicação vem com ordens diferentes.
4. **Preservar a informação dos intimados**: ao unificar duplicatas, listar no item mantido todos os intimados encontrados nas cópias, para nada ser perdido.
5. Aplicar a mesma regra nos exportadores que usam esse filtro (Resumo PDF sem repetição, Resumo DOC sem repetição, Doc Resumo Intimação sem repetição), centralizando a lógica em `src/utils/djenDedup.ts` para Análise DJEN e Análise DJEN Servidor usarem o mesmo código.

## Versão

Antes de aplicar a correção, o sistema passa a exibir **v4.5.4** no menu, com nota de release sobre a deduplicação dos resumos sem repetição. Assim fica fácil identificar (e reverter) esta versão caso o resultado não agrade.

## Detalhes técnicos

- `src/constants/version.ts`: `APP_VERSION = "4.5.4"` e nova entrada em `VERSION_HISTORY`; `public/version.json` atualizado para 4.5.4.
- `src/utils/djenDedup.ts`: reescrever `stripDestinatarios` e adicionar `dedupPubsSemDestinatarios` (chave: dígitos do processo + data de publicação + ID do documento extraído por regex + hash do teor normalizado com tokens ordenados), devolvendo também os intimados agregados por item mantido.
- `src/pages/AnaliseDjen.tsx` e `src/pages/AnaliseDjenServidor.tsx`: substituir a função local `dedupPubsPorProcessoSemDestinatarios` pela versão compartilhada; sem mudança de layout dos documentos além da linha de intimados unificados.
- A deduplicação de tela/contagem (por `coordenacao_id + id_djen`) permanece intacta — o ajuste é exclusivo das exportações "sem repetição".