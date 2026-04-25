UPDATE public.djen_proxy_pool
SET token = '1dbdba0f3a79646cb75f063e08a75da290b2ad8af3a803d5e40486dd82287062',
    enabled = true,
    pool_enabled_global = true,
    updated_at = now()
WHERE base_url = 'https://djen-google2.juriscontrol.adv.br:8443';

UPDATE public.djen_proxy_pool
SET enabled = true,
    pool_enabled_global = true,
    updated_at = now()
WHERE base_url = 'https://djen-hostinger.juriscontrol.adv.br';