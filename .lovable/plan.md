# Servidor próprio de WhatsApp no lugar da Z-API

## O que você precisa
1. **Um servidor (VPS)** — a Hostinger que já roda o DJEN serve, ou uma nova com 4 GB de RAM e 2 núcleos (aprox. 1 GB a mais para cada 10 a 15 números conectados).
2. **Um programa de código aberto e gratuito** que faz o papel da Z-API. A recomendação é a **Evolution API** (vários números, QR Code, envio de texto e arquivos, aviso de desconexão). A alternativa é o WAHA.
3. **Um endereço com HTTPS** (ex.: `whatsapp.juriscontrol.adv.br`), usando o Traefik que já existe na VPS.
4. **Um chip ou número para cada cliente**, conectado por QR Code, como na Z-API.

## Custo
- Só o servidor: cerca de R$ 40 a 120 por mês, com qualquer quantidade de números.
- Não há cobrança por número nem por mensagem.

## Riscos (importante)
- A Evolution API, assim como a Z-API, usa o WhatsApp Web sem autorização oficial da Meta. O risco de bloqueio do número é igual ao de hoje.
- A manutenção passa a ser sua: atualizar o programa quando o WhatsApp mudar e reconectar números que caírem.
- A opção oficial é a **WhatsApp Cloud API (Meta)**. Ela não bloqueia números, mas cobra por conversa e só aceita mensagens de modelos aprovados.

## Etapas
1. Instalar a Evolution API com Docker na VPS (Postgres e Redis), atrás do Traefik com HTTPS e com uma chave de acesso.
2. Criar uma instância por cliente e ler o QR Code.
3. No Juris Control:
   - criar o envio pela Evolution, mantendo a Z-API como reserva;
   - escolher em Administração qual provedor usar;
   - adaptar o monitor de conexão.
4. Testar com um número e depois migrar os demais clientes um a um.

## Detalhes técnicos
- Hoje o envio está concentrado em `enviar-whatsapp-zapi`. Cerca de 15 funções de alerta chamam essa função, e `monitorar-conexao-zapi` vigia a conexão.
- Será criado um adaptador único `enviar-whatsapp`, com `provedor = zapi | evolution`, para não alterar cada função de alerta.
- Novos segredos: `EVOLUTION_API_URL` e `EVOLUTION_API_KEY`, além do nome da instância por coordenação ou cliente.
