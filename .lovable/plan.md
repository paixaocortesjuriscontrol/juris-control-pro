# Alerta da Google VPS 5: não é certificado

## O que foi conferido agora (08/10/2026, 08:55 BRT)

- `https://djen-google5.juriscontrol.adv.br/djen-proxy/health` responde **200 em 1,2s**: a VPS está no ar.
- O certificado está válido até **01/12/2026**, renovado em 02/09/2026. A renovação automática funcionou.
- O alerta veio de uma **conexão recusada uma única vez** ("Connection reset by peer") no momento da checagem das 8h. Provavelmente foi um reinício do proxy ou uma oscilação de rede. O e-mail coloca a coluna "Certificado" do lado, e isso confunde.

## O que vou ajustar

1. **Repetir antes de acusar queda:** se a VPS falhar, a checagem diária tenta mais 2 vezes, com 20s de intervalo. Só depois disso marca "offline" e manda e-mail.
2. **E-mail mais claro:** separar "VPS fora do ar" de "Certificado vencendo". Quando o certificado estiver ok, aparece "Certificado OK (vence em 01/12/2026)" e o motivo vem em português, por exemplo: "conexão recusada pela VPS — 3 tentativas".
3. **Aviso de volta:** se a VPS voltar a responder no mesmo dia, ao clicar em "Testar agora" ou na checagem seguinte, o selo fica verde de novo.

## Detalhes técnicos

- `supabase/functions/verificar-saude-pool-djen`: retry (3 tentativas, intervalo de 20s) só para erros de conexão e timeout; tradução dos erros comuns (ECONNRESET, ECONNREFUSED, timeout, cert expirado); e-mail com seções separadas para queda e para certificado.
- Nada muda nas VMs, no pool nem no banco.
