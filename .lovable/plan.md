# DJEN Servidor mais resistente a quedas (modelo "caderno")

## O que muda para você
Hoje o DJEN Servidor pesquisa advogado por advogado e termo por termo no Comunica PJe. Quando o site cai ou bloqueia (como em 16/11/2026), as coordenações ficam sem publicações.
A proposta é fazer como os serviços tipo Kurier: baixar de uma vez o **caderno completo do dia** de cada tribunal, guardar no sistema e fazer a busca por nome/OAB/termos dentro desse material guardado.

## Etapas
1. **Download do caderno por tribunal e data** logo após a disponibilização (madrugada, ex.: 01h00, 03h00 e 05h00), com novas tentativas automáticas a cada 15 minutos até 09h00 quando houver falha ou bloqueio.
2. **Guardar o caderno** (arquivo e comunicações extraídas) na base própria, com registro de tribunal, data, horário do download e situação.
3. **Busca local**: os termos, advogados e partes de cada coordenação passam a ser conferidos dentro do caderno guardado, respeitando as regras atuais (parte só em partes; advogado só em advogados; escopo de tribunais por coordenação; isolamento por coordenação).
4. **Gravação igual à de hoje** em `publicacoes_djen`, com a mesma deduplicação — sem duplicar o que a consulta normal ou o Kurier já trouxeram.
5. **Consulta normal mantida como reserva**: se o caderno de um tribunal não for obtido, a rodada atual continua funcionando como hoje.
6. **Registro de indisponibilidade**: guardar cada falha/bloqueio do DJEN com data e hora (BRT), para servir de prova em eventual contagem de prazo.
7. **Tela de acompanhamento**: no DJEN Servidor, um quadro por tribunal mostrando se o caderno do dia foi baixado, quantas comunicações tem e quantas publicações geraram.

## Detalhes técnicos
- Endpoint: `comunicaapi.pje.jus.br/api/v1/caderno/{tribunal}/{data}/{meio}` (retorna link para arquivo compactado). Não é usado hoje no projeto.
- Download feito pelo monitor na VPS (`monitor-servidor`, com `proxyPool`), pois arquivos grandes e bloqueios 403 inviabilizam Edge Function.
- Novas tabelas: `djen_cadernos` (tribunal, data, meio, status, tentativas, total) e `djen_indisponibilidades`; RLS somente leitura para usuários autenticados com acesso, escrita só service_role.
- Primeiro passo de implementação: testar o endpoint para TST e um TRT e confirmar formato e tamanho reais antes de construir a busca local.

## Fora do escopo agora
- Integração com PJe por credencial de advogado e Domicílio Judicial Eletrônico (pode ser etapa futura).
