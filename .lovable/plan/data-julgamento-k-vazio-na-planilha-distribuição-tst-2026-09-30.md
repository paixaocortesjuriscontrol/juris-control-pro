# "Data Julgamento? (K)" vazio na planilha — Distribuição TST

## O que foi encontrado (procede)
- O sistema **salva** o campo: no histórico dos últimos 60 dias só 8 valores preenchidos foram apagados depois.
- A causa é **cadastro duplicado**: há 343 processos com **dois registros** (mesmo processo e mesmo dossiê, ou dossiê vazio x "Não localizado"). A equipe preenche um dos registros, e o outro fica vazio.
- Na hora de gerar a planilha, entra o registro vazio (ou os dois). Por isso a coluna K sai sem preenchimento mesmo depois de corrigida.
- "Não" e "N" já saem como "N" na planilha. Isso não é problema.

## O que fazer
1. **Correção imediata (dados):** nos 343 processos duplicados, copiar para o registro vazio os campos de julgamento que estão preenchidos no outro registro: Data Julgamento? (K), data, horário e tipo. Nada que já está preenchido será sobrescrito.
2. **Na geração da planilha:** quando o mesmo processo aparecer duas vezes, completar os campos de julgamento vazios com os do registro irmão. Assim o K não sai vazio por causa da duplicidade.
3. **Na ficha:** ao salvar Data Julgamento? (K), gravar também no registro duplicado do mesmo processo e dossiê. Assim os dois registros ficam iguais.
4. Gerar para a Dra. Lienne uma planilha com os 343 processos duplicados, para ela decidir depois se arquiva as cópias. Nesta etapa, nenhuma cópia será arquivada automaticamente.

## Detalhes técnicos
- Duplicidade medida por `regexp_replace(processo,'\D','','g')` + dossiê (tratando nulo = "Não localizado").
- Passo 1: UPDATE em `dados_benner` só onde `tem_data_julgamento is null` e o irmão não é nulo; a auditoria registra a alteração.
- Passo 2: `CargaBennerFromDb.tsx` (~602-630) e `gerarPlanilhaBenner.ts`: mapa por dígitos do processo com fallback de `tem_data_julgamento`, `data_julgamento`, `horario_julgamento` e `tipo_julgamento`.
- Passo 3: `onSaveBennerExtra` em `DistribuicaoTstDetail.tsx` replica esses 4 campos para irmãos com o mesmo processo e dossiê.
