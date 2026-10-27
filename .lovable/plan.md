# Complementar processos da migração Projuris com a planilha "Processos em planilha"

## O que a planilha traz
A planilha tem 15.700 processos e 63 colunas. As mais preenchidas são: Identificador (PRO.xxxx), Número CNJ, Assunto, Situação, Pasta física/cliente, Descrição, Responsáveis, Marcadores, Justiça, Instância, Órgão, Sistema/Sistema Judicial, Segredo de justiça, Data distribuição, Valor ação/provisionado, Probabilidade, Cliente e documento, Partes ativas/passivas e documentos, Estado, Cidade, Comentários, Processos relacionados e últimos andamentos.

## Como vai funcionar
1. Na tela **Migração Projuris** (só admin), nova opção **"Complementar pela planilha de processos"**, onde você envia o arquivo .xlsx.
2. A leitura acontece no computador, sem travar a tela. Cada linha é ligada ao processo **já importado pela migração Projuris**:
   - primeiro pelo Identificador (PRO.xxxx) registrado na migração;
   - se não achar, pelo Número CNJ, somente quando existir **um único** processo com esse número.
   Linhas sem par ou com número repetido entram na conferência e não são aplicadas.
3. **Conferência antes de aplicar:** quantos processos foram encontrados, quantos campos vazios serão preenchidos, quantos conflitos existem (campo já preenchido com valor diferente) e quantas linhas ficaram sem par. Você pode baixar esse relatório.
4. **Aplicar:** preenche **somente campos vazios**, nunca apaga nem sobrescreve. Os conflitos ficam registrados para consulta, igual ao botão "Recuperar complementos". A aplicação é feita em lotes, com barra de progresso.

## Mapeamento planilha → ficha do processo
- Assunto → assunto; Descrição → descrição; Pasta física/cliente → pasta física/cliente
- Situação, Instância, Justiça, Órgão (tribunal/órgão julgador), Estado (UF), Cidade (comarca), Área
- Sistema / Sistema Judicial → sistema; Segredo de justiça → segredo de justiça
- Data distribuição; Valor ação → valor da causa; Valor provisionado; Probabilidade
- Partes ativas/passivas → polo ativo/passivo (e documentos, quando houver campo)
- Responsáveis → responsáveis Projuris (texto); Marcadores → etiquetas/observação
- Comentários, Processos relacionados, Numeração complementar e últimos andamentos → bloco "Informações complementares do Projuris" em observações (sem duplicar se já existir)
- Colunas vazias na planilha (Data citação, Risco, Resultado etc.) são ignoradas.

## Detalhes técnicos
- Novo `src/lib/projurisPlanilhaProcessos.ts`: lê os cabeçalhos pela linha "Identificador" (a 3ª linha), normaliza valores (datas para ISO, valores numéricos, enum de área, "Sim/Não" para booleano) e gera `Complementos` no mesmo formato de `complementosProjuris`.
- Leitura em Web Worker (padrão das planilhas grandes). A ligação usa `migracoes_projuris_itens` (tipo processo + chave_externa = Identificador) e cai no CNJ por dígitos, reaproveitando `fontesComplementosUnicas`/`selecionarComplementos`.
- A aplicação usa a RPC já existente `recuperar_complementos_projuris` (admin, só campos vazios, conflitos auditados, índice por dígitos). Só altero o banco se algum campo novo do mapeamento não for aceito pela RPC; nesse caso, só amplio a lista de campos dela.
- Testes de unidade do mapeamento: datas, valores, Sim/Não, CNJ ambíguo rejeitado, campo preenchido gera conflito.
