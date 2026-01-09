-- Reabrir o alerta da 1ª parcela para permitir retry (WhatsApp não chegou)
UPDATE public.alertas_parcela
SET enviado = false,
    enviado_em = null
WHERE id = '4718d8b6-70e5-4450-a49a-e0fbb9f0baa1';