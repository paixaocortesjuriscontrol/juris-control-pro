-- Reabrir o alerta da 1ª parcela para permitir retry (WhatsApp não chegou)
update public.alertas_parcela
set enviado = false,
    enviado_em = null
where id = '4718d8b6-70e5-4450-a49a-e0fbb9f0baa1';