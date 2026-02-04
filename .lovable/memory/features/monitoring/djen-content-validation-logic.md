# Memory: features/monitoring/djen-content-validation-logic
Updated: 04/02/2026

A validação de conteúdo do DJEN foi ajustada para evitar descartes excessivos:

## Regras de Validação:
- **Advogados (OAB)**: Exige número da OAB (regex flexível) + 80% das palavras do nome
- **Palavras-chave/Partes**: Exige **80% das palavras significativas** (não mais 100%)
- **Termos Ignorados na Contagem**: LTDA, SA, ME, EPP, EIRELI, CIA, SOCIEDADE, EMPRESA, COMERCIO, INDUSTRIA, SERVICOS, DE, DO, DA, DOS, DAS, E, EM, COM, PARA, POR
- **Termos com "&"**: Letras isoladas (ex: "F & F") são consideradas obrigatórias quando há 2+ delas

## Motivação:
A validação de 100% era muito restritiva - descartava publicações válidas quando havia variações como:
- "HOSPITAL XYZ S.A." vs "HOSPITAL XYZ LTDA"
- Nomes com acentos diferentes
- Pequenas variações de grafia

## Arquivos Atualizados:
- `src/hooks/useDjenTermosEngine.ts`
- `src/hooks/useSincronizarDjenBrowser.ts`
- `src/utils/djenTermoMatch.ts`
- `supabase/functions/monitorar-djen/index.ts`
