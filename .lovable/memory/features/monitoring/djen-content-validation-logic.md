# Memory: features/monitoring/djen-content-validation-logic
Updated: 05/02/2026

A validação de conteúdo do DJEN usa **FRASE EXATA 100%** para garantir precisão.

## Regras de Validação (TODAS usam 100% estrito):
- **Palavra-chave**: Frase exata deve aparecer no texto (ex: "Super Quadra" não casa com "enquadramento")
- **Advogados (OAB)**: Exige número da OAB (regex flexível para pontos/espaços) + nome 100% como frase exata
- **Parte (Polo ativo/passivo)**: Frase exata deve aparecer no texto
- **Processo**: Número (apenas dígitos) deve aparecer no texto

## Lógica AND (+):
Termos com "+" (ex: "DR. OSMAR + SERVICO DE APOIO") exigem que CADA segmento apareça 100% no texto.

## Lógica OR (termos_or):
Para advogados, se houver termos_or, pelo menos UM deles deve casar 100%.

## Validação de Conteúdo:
- A validação ocorre APENAS no campo de texto da publicação (conteudo/teor/texto)
- Metadata como `destinatarioNome` NÃO é usada para validação
- O termo de busca NUNCA deve ser injetado na lista de advogados extraídos

## Arquivos Sincronizados:
- `src/hooks/useDjenTermosEngine.ts`
- `src/hooks/useBuscaDjenDireta.ts`
- `src/hooks/useSincronizarDjenBrowser.ts`
- `src/utils/djenTermoMatch.ts`
- `supabase/functions/monitorar-djen/index.ts`
