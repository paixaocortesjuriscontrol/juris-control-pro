# Resumo de intimações DJEN: trazer o dispositivo da decisão

## O problema confirmado

Nos exemplos marcados pela advogada, o trecho que faltou (amarelo) é sempre o **dispositivo da decisão** — "ISTO POSTO ACORDAM os Ministros...", "Pelas razões expostas... nego seguimento", "CONCLUSÃO" — e o trecho dispensável (verde) é sempre o **texto padrão do PJe** ("O documento está disponibilizado na íntegra na Consulta Processual... chave... Resolução nº 455/2018 do CNJ... endereço de validação").

Causa: o resumo pega "os últimos 2 parágrafos substantivos" antes da assinatura/intimados. O texto padrão do PJe tem dois parágrafos longos (mais de 300 caracteres cada), então ele é escolhido como se fosse o conteúdo da decisão, o orçamento de caracteres é atingido e o dispositivo real, que vem logo antes, fica de fora. Confirmado na publicação 0010709-32.2014.5.15.0141: o texto original traz o "ISTO POSTO ACORDAM..." completo, mas o documento gerado começa direto na assinatura.

## O que muda

1. **Descartar o texto padrão do PJe** (chave de validação, endereços do PJe, referência à Resolução 455/2018 do CNJ e o nome em caixa-alta do servidor que assina eletronicamente). Ele deixa de ocupar espaço no resumo e deixa de aparecer no documento.
2. **Ancorar o resumo no dispositivo**: quando o texto contiver um marcador de dispositivo ("ISTO POSTO", "ACORDAM os Ministros", "Ante o exposto", "Isso posto", "Pelas razões expostas", "Diante do exposto", "CONCLUSÃO", "nego seguimento", "Aguarde-se em Secretaria"), o resumo passa a começar no **último** marcador e seguir até o fim, garantindo que a parte decisória apareça na íntegra.
3. **Manter o que já funciona**: assinatura do relator, bloco "Intimado(s) / Citado(s)" e o tratamento especial de pautas de julgamento e editais continuam iguais.
4. Sem esses marcadores, mantém a regra atual dos últimos parágrafos — agora já sem o texto padrão do PJe competindo por espaço.

Resultado esperado nos exemplos enviados: o dispositivo em amarelo sai automaticamente e o bloco em verde não aparece mais.

## Detalhes técnicos

- `src/pages/AnaliseDjen.tsx` — função `extractResumoSemIA`: novo filtro `ehBoilerplatePje(p)` aplicado após a indexação de parágrafos (remove os blocos de validação PJe/CNJ e a linha em caixa-alta do servidor que os segue) e nova etapa de ancoragem no último marcador de dispositivo antes da regra dos "últimos N parágrafos".
- `src/pages/AnaliseDjenServidor.tsx` — mesma função duplicada; recebe as mesmas alterações para os dois motores gerarem documentos idênticos.
- Vale para os botões "Resumo (sem IA)", "Resumo sem repetição" e "Resumo de intimações", pois todos usam o mesmo extrator.
- Sem alterações de banco de dados e sem alterações em Edge Functions.