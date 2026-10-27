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
- Sistema Judicial (ou, se vazio, Sistema) → Sistema Judicial, com grafias ajustadas à lista; Segredo de justiça → segredo de justiça
- Data distribuição; Valor ação → valor da causa; Valor provisionado; Probabilidade
- Partes ativas/passivas → polo ativo/passivo (e documentos, quando houver campo)
- Responsáveis → responsáveis Projuris (texto); Marcadores → etiquetas/observação
- Comentários, Processos relacionados, Numeração complementar e últimos andamentos → bloco "Informações complementares do Projuris" em observações (sem duplicar se já existir)
- Colunas vazias na planilha (Data citação, Risco, Resultado etc.) são ignoradas.

## Novo campo "Sistema Judicial" na tela Processos e Casos
- Na ficha do processo, logo abaixo de **Responsáveis**, aparece o campo **Sistema Judicial**, editável direto no campo, com a lista: Eproc, Esaj, Projudi, PJE, Portal de Serviços, Portal do Advogado, JPE, Próprio Site, Tucujuris, SEI.
- O valor fica no campo "sistema" do processo, que já existe. Não é preciso criar coluna nova.
- A complementação usa a coluna "Sistema Judicial" da planilha, com 5.370 processos preenchidos: Eproc 2.565, PJE 1.568, Projudi 949, Esaj 224, Portal do Adv 21, Jpe 20, Portal de Serviços 19, Próprio Site 2, SEI 2. Grafias diferentes passam para a opção da lista: "Portal do Adv" vira Portal do Advogado e "Jpe" vira JPE.
- Valores antigos que não estão na lista continuam aparecendo no processo, sem serem apagados.

## Detalhes técnicos
- Novo `src/lib/projurisPlanilhaProcessos.ts`: lê os cabeçalhos pela linha "Identificador" (a 3ª linha), normaliza valores (datas para ISO, valores numéricos, enum de área, "Sim/Não" para booleano) e gera `Complementos` no mesmo formato de `complementosProjuris`.
- Leitura em Web Worker (padrão das planilhas grandes). A ligação usa `migracoes_projuris_itens` (tipo processo + chave_externa = Identificador) e cai no CNJ por dígitos, reaproveitando `fontesComplementosUnicas`/`selecionarComplementos`.
- A aplicação usa a RPC já existente `recuperar_complementos_projuris` (admin, só campos vazios, conflitos auditados, índice por dígitos). Só altero o banco se algum campo novo do mapeamento não for aceito pela RPC; nesse caso, só amplio a lista de campos dela.
- Testes de unidade do mapeamento: datas, valores, Sim/Não, CNJ ambíguo rejeitado, campo preenchido gera conflito.
