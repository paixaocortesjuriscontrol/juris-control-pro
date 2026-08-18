# Script de auto-renovação dos certificados nas VMs

## Objetivo

Um único script, idempotente, para colar/rodar em cada VM do pool DJEN (vm01, vm02, vm09) que garanta:

1. O Certbot renova o certificado sozinho (timer systemd ativo).
2. Após cada renovação, o proxy é reiniciado automaticamente para carregar o certificado novo — foi a ausência disso que causou a queda de julho.
3. As permissões de leitura dos certificados continuam válidas para o usuário que roda o proxy.
4. Uma simulação (`certbot renew --dry-run`) confirma no ato que a renovação funcionará.

## O que o script faz (passo a passo)

1. **Detecta o ambiente**: domínio do certificado (`certbot certificates`), serviço do proxy (`djen-proxy.service`), se há Nginx ativo, e o usuário do serviço.
2. **Garante o timer do Certbot**: `systemctl enable --now certbot.timer` e mostra o próximo horário agendado.
3. **Cria o hook de deploy** em `/etc/letsencrypt/renewal-hooks/deploy/99-reload-djen-proxy.sh`, executável, que:
   - recarrega o Nginx se estiver ativo (`nginx -t && systemctl reload nginx`);
   - reinicia `djen-proxy.service` se existir;
   - reaplica grupo/permissões de leitura em `live/` e `archive/` (grupo `letsencrypt`), para o proxy não-root conseguir ler a chave nova;
   - grava log em `/var/log/djen-cert-renew.log` com data, domínio e resultado.
4. **Normaliza permissões agora**: cria grupo `letsencrypt` se faltar, adiciona o usuário do proxy, aplica `chgrp -R` + `chmod -R g+rX`.
5. **Valida**: roda `certbot renew --dry-run`, imprime `notAfter` atual via `openssl s_client` na porta do proxy e o status do serviço. Falha ruidosamente se o dry-run não passar.

Rodar de novo não duplica nada — o hook é sobrescrito e as permissões reaplicadas.

## Como você vai usar

No console SSH do Google, em cada VM:

```bash
curl -fsSL https://juriscontrol.adv.br/scripts/instalar-auto-renovacao-cert.sh -o /tmp/renov.sh
sudo bash /tmp/renov.sh
```

Ou, se preferir não depender de download, o script também fica no repositório para copiar e colar via heredoc — entrego o bloco pronto.

Parâmetros opcionais (o script detecta sozinho, mas dá para forçar):

```bash
sudo DOMINIO=djen-google2.juriscontrol.adv.br PORTA=8443 SERVICO=djen-proxy bash /tmp/renov.sh
```

## Detalhes técnicos

- Novo arquivo no repositório: `djen-proxy/instalar-auto-renovacao-cert.sh` (bash, `set -euo pipefail`, sem dependências além de certbot/systemd/openssl).
- Cópia publicada em `public/scripts/instalar-auto-renovacao-cert.sh` para permitir o `curl` direto do domínio do app.
- Seção nova no `djen-proxy/README.md` documentando uso, saída esperada e como conferir o log de renovações.
- Nada muda no app nem no banco: o monitor diário `verificar-saude-pool-djen` (8h BRT) continua sendo a rede de segurança, alertando por e-mail a 30/15/7/1 dia do vencimento caso alguma renovação falhe.

## Fora de escopo

Executar o script nas VMs — isso só acontece pelo SSH do console do Google, com você colando os comandos. O Lovable não tem acesso às VMs.
