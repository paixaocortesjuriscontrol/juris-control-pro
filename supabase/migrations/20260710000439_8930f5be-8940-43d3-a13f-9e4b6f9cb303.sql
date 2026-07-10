CREATE UNIQUE INDEX IF NOT EXISTS uq_pub_djen_stf_mon_hash
ON public.publicacoes_djen (monitoramento_id, hash_conteudo)
WHERE fonte = 'stf_digital';