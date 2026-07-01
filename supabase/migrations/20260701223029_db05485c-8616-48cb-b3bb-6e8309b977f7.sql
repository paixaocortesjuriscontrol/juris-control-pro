INSERT INTO public.djen_proxy_pool (label, base_url, token, enabled)
VALUES
  ('Google VPS 10', 'https://djen-google10.juriscontrol.adv.br', '1dbdba0f3a79646cb75f063e08a75da290b2ad8af3a803d5e40486dd82287062', true),
  ('Google VPS 11', 'https://djen-google11.juriscontrol.adv.br', '1dbdba0f3a79646cb75f063e08a75da290b2ad8af3a803d5e40486dd82287062', true),
  ('Google VPS 12', 'https://djen-google12.juriscontrol.adv.br', '1dbdba0f3a79646cb75f063e08a75da290b2ad8af3a803d5e40486dd82287062', true)
ON CONFLICT DO NOTHING;