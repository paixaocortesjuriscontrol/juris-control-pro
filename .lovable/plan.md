# Pautas de Julgamento: preencher todos os campos pedidos

## O que encontrei (348 pautas automáticas)
- **Advogado interno:** vazio em todas. A rotina nunca preenche esse campo, mas o Benner já tem os responsáveis do processo (tela Distribuição TST).
- **Reclamante/Reclamada:** vazios em ~270. Em 144 a pauta está ligada ao Benner, mas o Benner também não tem as partes. Em 126 não achou o processo no Benner (só 3 existem lá com outra marcação de aba).
- **Equipe:** vazia em 176, pelo mesmo motivo (sem ligação ao Benner).
- Número, data, órgão, modalidade e relator já vêm em quase todas.

## O que vai mudar
1. **Advogado interno:** preencher com o(s) nome(s) dos responsáveis do processo no Benner (separados por vírgula).
2. **Reclamante e Reclamada:** quando o Benner não tiver, tirar da própria publicação do DJEN (partes "Recorrente/Agravante/Reclamante" e "Recorrido/Agravado/Reclamado"), identificando o banco como Reclamada.
3. **Ligação com o Benner mais ampla:** procurar o processo no Benner mesmo sem a marcação de aba, para trazer dossiê, equipe e advogado em mais casos.
4. **Horário:** gravar só quando for Presencial/Telepresencial; nas virtuais fica em branco.
5. **Ministro relator:** manter o do Benner; se vazio, o da publicação (já é assim).
6. **Correção das pautas já existentes:** completar só os campos vazios das 348 pautas automáticas, sem apagar nada que já foi preenchido à mão.

## Limitação
Processos que não estão cadastrados no Benner continuarão sem dossiê, equipe e advogado interno (essas informações só existem lá). Reclamante, Reclamada, data, órgão, modalidade e relator virão da publicação.

## Detalhes técnicos
- Atualizar `gerar_pautas_tst_auto`: `advogado_interno` = `string_agg(profiles.nome)` de `dados_benner_responsaveis`; busca em `dados_benner` por `processo = num` priorizando `aba_origem IS NOT NULL`; regex de partes no texto; `hora` nula quando Virtual.
- UPDATE único com `coalesce` nos campos vazios das pautas `origem='djen_auto'`, relendo a publicação ligada (`publicacao_djen_id`).
- Sem mudança de permissões nem da tela.
