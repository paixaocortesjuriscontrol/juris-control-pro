# Importar Processos (Dra. Beatriz Costa): travar duplicidade

## O que a conferência mostrou
A importação já tenta não duplicar: se o processo existe, atualiza em vez de cadastrar. Mas a comparação é pelo **texto exato** do número. Por isso ainda duplica quando:
1. O número está escrito de outro jeito (ex.: `0011639-05.2026.5.03.0031` na base e `00116390520265030031` na planilha, ou com espaço/ponto diferente).
2. O mesmo processo aparece em duas linhas/abas da planilha com formatação diferente: as duas entram.

## O que será feito
1. Comparar sempre **só os dígitos** do número, tanto na planilha quanto na base inteira (todas as coordenações).
2. Processo que já existe: é atualizado, nunca cadastrado de novo (continua como hoje, mas agora achando qualquer formato).
3. Mesmo processo repetido na planilha: entra uma vez; as outras linhas aparecem na lista como "repetido na planilha".
4. Conferir de novo logo antes de gravar cada lote, para evitar duplicar se outra importação rodar ao mesmo tempo.
5. Nada já gravado é apagado.

## Detalhes técnicos
- `src/components/importar/BeatrizCostaImportTab.tsx`: chave do `validMap` passa a ser `onlyDigits(numero)`; busca de existentes via RPC `find_processo_by_digits` (ou consulta por dígitos em lotes) em vez de `.in("numero", ...)`; `existingMap` indexado por dígitos; nova checagem antes de cada `insert`.
