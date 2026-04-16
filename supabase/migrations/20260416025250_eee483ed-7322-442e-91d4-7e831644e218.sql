ALTER TABLE public.distribuicoes_tst
ADD COLUMN IF NOT EXISTS judit_preenchido BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS judit_preenchido_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS judit_preenchido_por UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_distribuicoes_tst_judit_preenchido
ON public.distribuicoes_tst (judit_preenchido);

CREATE INDEX IF NOT EXISTS idx_distribuicoes_tst_judit_preenchido_em
ON public.distribuicoes_tst (judit_preenchido_em DESC);