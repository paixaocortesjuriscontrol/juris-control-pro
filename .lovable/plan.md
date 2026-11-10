# Publicação 0000078-28.2026.5.10.0018 (05/11/2026) fora da Coordenação Dra. Janaina

## O que encontrei
- O processo está cadastrado na Coordenação Dra. Janaina Catunda.
- A publicação chegou pelo Kurier (logins paixaoc e paixao.cortes.adv) em 06/11/2026 e foi gravada só na **Coordenação GOL** e nas coordenações "Somente Kurier".
- Motivo 1 — grafia do termo: o termo da Dra. Janaina é **"REDE D'OR SAO LUIZ"** (com apóstrofo, só TRT10). A publicação escreve **"REDE DOR SAO LUIZ"** (sem apóstrofo). A comparação não ignora o apóstrofo, então não casou.
- Motivo 2 — só uma coordenação por publicação: na rotina do Kurier, quando um termo casa, ela para no primeiro e grava só naquela coordenação. A GOL casou primeiro pelo termo de advogado "OSMAR MENDES PAIXAO"; mesmo que o termo da Dra. Janaina casasse, ela ficaria de fora.
- A Dra. Janaina não tem captura total no Kurier (vínculos marcados como "Termos DJEN"), então depende só dos termos.

## O que vou fazer
1. **Ignorar apóstrofos e pontuação** na comparação de termos de parte/advogado do Kurier (D'OR = DOR = D OR). Vale também para o motor DJEN Servidor, se ele tiver a mesma falha.
2. **Gravar em todas as coordenações cujo termo casar**, não só na primeira. Cada coordenação continua respeitando os próprios termos, exclusões e tribunais (isolamento preservado). Regras de parte só em partes e advogado só em advogados continuam.
3. **Recuperar esta publicação** na Coordenação Dra. Janaina, como não lida.
4. **Varrer as publicações Kurier desde 01/10/2026** que deixaram de entrar em alguma coordenação por esses dois motivos e entregar a elas (sem duplicar o que já existe), com relatório da quantidade por coordenação.
5. Teste automático: "REDE D'OR SAO LUIZ" casa com "REDE DOR SAO LUIZ"; publicação que casa termos de duas coordenações vai para as duas.

## Detalhes técnicos
- `supabase/functions/kurier-consultar-publicacoes/index.ts`: o laço de candidatos (≈linha 1101) faz `break` no primeiro `matched`; trocar por lista de matches, uma por `coordenacao_id`, inserindo cada uma (mesma lógica de dedup por `coord|hash`). Captura total já pula coords que receberam via match.
- Normalização em `_kurier-shared/djenMatch*.ts`: remover `'’´\`` e pontuação antes de comparar termo e texto; conferir o equivalente no worker/paralela do Servidor.
- Recuperação via `kurier_publicacoes_raw` reprocessada com a nova regra, em lotes, inserindo em `publicacoes_djen` com o `monitoramento_id` do termo casado.
