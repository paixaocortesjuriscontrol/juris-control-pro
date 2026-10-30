# Nova Coordenação ADOBE/CREFISA

## O que será feito
1. **Criar a coordenação** "COORDENAÇÃO ADOBE/CREFISA", com responsáveis Carlos Elias (coordenador) e Lucas Carreiro (membro). Primeiro confiro se os dois já têm usuário no sistema. Se algum não tiver, aviso e fica pendente.
2. **Monitoramento DJEN por advogado**, ligado à nova coordenação:
   - Advogados pesquisados: Dr. Carlos e Dr. Osmar.
   - Tribunais: TRT 10 e TST.
   - Condição: a publicação só é aceita se o advogado aparecer **e** a parte contiver um destes nomes:
     - ADOBE ASSESSORIA DE SERVICOS CADASTRAIS
     - CREFISA SA CREDITO FINANCIAMENTO E INVESTIMENTOS
   - **No TST**, entra também o nome do Dr. Lucas Carreiro como advogado pesquisado.
3. Publicações encontradas caem na Análise DJEN da nova coordenação, separadas das outras equipes.

## Antes de executar, preciso confirmar
- Nome completo e OAB (número/UF) do Dr. Carlos e do Dr. Osmar, e a OAB do Dr. Lucas Carreiro, porque a busca por advogado usa esses dados.
- "Concomitantes" quer dizer advogado + parte ADOBE **ou** CREFISA (uma das duas basta). Se as duas empresas tiverem de aparecer juntas na mesma publicação, me avise.

## Detalhes técnicos
- Cadastro em `coordenacoes` e `membros_coordenacao` (cargos em snake_case, conferindo a linha retornada), e monitoramentos em `monitoramentos_djen` / `parametros_monitoramento_djen`, um por tribunal (TRT10, TST). Os termos das partes ficam como termos obrigatórios. Sigo a regra de que a busca por advogado valida só a seção de advogados e os termos das partes validam só as partes.
- Feito pelas telas existentes, ou por inserção de dados. Não muda a estrutura do banco nem as regras de acesso.
