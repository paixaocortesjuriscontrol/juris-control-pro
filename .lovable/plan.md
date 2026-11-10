# Onde rodam as rotinas do sistema

## O "servidor do sistema"
Quando falei em "servidor do sistema", me referia ao **Supabase**, o serviço em nuvem contratado na sua conta (projeto bfxahrrvoqxcdmfsvnrk). Ele não é a VPS da Hostinger nem a AWS. Nele ficam:
- **O banco de dados:** processos, tarefas, publicações, usuários e tudo o mais.
- **104 rotinas** que rodam sob demanda: DJEN Pautas, Kurier, envio de alertas, WhatsApp, Judit e outras.
- **26 agendamentos automáticos:** buscas de pautas nos horários definidos, alertas, encerramento de buscas travadas e a geração de Pautas/Distribuições TST a cada 15 minutos.

A correção do DJEN Pautas desta tarde foi feita aqui. Por isso não foi preciso mexer na VPS.

## Os outros dois lugares
- **VPS Hostinger (31.97.173.98):** roda só o programa do **DJEN Servidor** (`jc-monitor-servidor`). Ele é atualizado com `git pull` e `pm2 restart`.
- **Lovable:** hospeda as telas que os usuários abrem em juriscontrol.adv.br.

```text
Usuários -> Telas (Lovable) -> Supabase (banco + 104 rotinas + 26 agendamentos)
                                   ^
                    VPS Hostinger (DJEN Servidor) grava no Supabase
```

## Próximo passo, se quiser migrar para a AWS
Ao aprovar este plano, eu levanto um mapa completo:
- cada rotina e o que ela faz;
- cada agendamento, com seu horário;
- quais chaves e senhas cada uma usa;
- o que depende da VPS.

Junto, mando uma estimativa do caminho para cada opção:
- **VPS para a AWS:** é a mudança mais simples, levar o programa do DJEN Servidor para uma máquina EC2.
- **Supabase para a AWS:** é a mudança maior. Envolve o banco (RDS/Postgres), as rotinas (Lambda) e os agendamentos (EventBridge). O login de usuários e as regras de acesso também teriam de ser refeitos.

Nada será alterado nessa etapa. Ela é só de levantamento.
