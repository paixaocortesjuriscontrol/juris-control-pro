UPDATE public.dados_benner
SET tipo_recurso_reclamante = 'RO',
    tipo_recurso_banco      = 'AIRR',
    tipo_recurso            = 'AIRR',
    tribunal                = 'TST'
WHERE processo = '0001376-72.2023.5.10.0014';

UPDATE public.dados_benner
SET tipo_recurso_reclamante = NULL,
    tipo_recurso_banco      = NULL,
    tipo_recurso            = NULL,
    tribunal                = 'TRT11'
WHERE processo = '0000755-53.2024.5.11.0001';