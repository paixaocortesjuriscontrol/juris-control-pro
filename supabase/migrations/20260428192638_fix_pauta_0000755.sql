-- Atualiza o registro do processo 0000755-53.2024.5.11.0001 com a data de
-- julgamento correta retornada pela busca Judit (sessão virtual da 5ª Turma TST
-- de 27/04/2026). O auto-save anterior gravou data desatualizada (06/04/2026)
-- e tem_data_julgamento=N. Corrigimos para refletir o pauta atual.
UPDATE public.dados_benner
SET
  tem_data_julgamento = 'S',
  data_julgamento = DATE '2026-04-27',
  tipo_julgamento = 'Virtual'
WHERE processo = '0000755-53.2024.5.11.0001';
