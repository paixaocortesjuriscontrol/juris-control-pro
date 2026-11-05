# DJEN AUTOMÁTICO tag only on processes the routine created

## Why it happened
The approved plan said a process already on the screen would also get the tag, plus a "já estava no sistema" mark. On 04/11 at 17:31 (Brasília) the first search lit up 157 processes:
- 84 new ones, created by the routine
- 73 that already existed, which got the tag anyway

## What changes
1. **From now on:** the tag goes only on processes the routine creates. When a process already exists, the routine only records that it showed up in the DJEN (distribution date, if that was empty, and the "já existia" mark), with no tag.
2. **Cleanup:** remove the DJEN AUTOMÁTICO tag from the 73 processes that already existed. Nothing else on them changes.
3. **Report for Dra. Iara:** stays the same. The "Já estavam no sistema" filter keeps working, because it uses the mark and not the tag.

## Technical details
- Migration recreating `gerar_distribuicoes_tst_auto`: insert into `dados_benner_processo_tags` only on the branch that inserts a new row in `dados_benner`.
- Delete from `dados_benner_processo_tags` the DJEN AUTOMÁTICO tag where `dados_benner.ja_existia_antes_djen = true`.
