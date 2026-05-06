INSERT INTO public.dados_benner_responsaveis (dados_benner_id, usuario_id)
SELECT d.id, 'b6ad7321-65fa-41ff-bff2-bdace43c9f66'::uuid
FROM public.dados_benner d
WHERE d.aba_origem='TST_distribuicao_docx'
ON CONFLICT DO NOTHING;