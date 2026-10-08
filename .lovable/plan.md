# Pautas de Julgamento TST (Santander) dentro do sistema

## O que já existe
O sistema já tem a tela **Pautas TST** (Admin. TST), com as mesmas 31 colunas da planilha da equipe da Dra. Renata Oficial. Hoje ela tem só 17 pautas, mostra no máximo 500 linhas, não separa as semanas e não gera a planilha para o Santander. A ficha do processo também já tem uma aba de pautas.

## O que vamos fazer

1. **Importar o histórico da planilha enviada**
   - São 34 abas semanais, de 02/02 a 06/11, com 2.032 pautas.
   - O nome de cada aba fica guardado como "semana" (ex.: "32. 19.10 a 23.10").
   - Pautas que já estão no sistema não são repetidas. Contam como repetidas quando têm o mesmo processo e a mesma data de julgamento.
   - Cada pauta é ligada à ficha do processo e à ficha da Distribuição TST, pelo número do processo ou pelo dossiê.
   - Ao final sai um relatório com o que foi importado, o que já existia e as linhas com erro.

2. **Tela Pautas TST organizada por semana**
   - No alto fica a escolha da semana, que abre na semana atual, e cards com o total, o virtual, o presencial e as pautas sem decisão.
   - A tabela tem filtros por relator, órgão, advogado e decisão, mostra todas as pautas da semana sem o limite de 500 e permite editar direto na linha.
   - O botão **Nova pauta** preenche sozinho dossiê, equipe, partes, relator, matérias, aparelhamento e chance de êxito, puxando da Distribuição TST pelo número do processo.

3. **Gerar a planilha semanal para o Santander**
   - O botão **Exportar semana** gera o Excel no mesmo layout e na mesma ordem de colunas da planilha atual, com o nome da aba no padrão "N. dd.mm a dd.mm".
   - Também dá para exportar um período com várias semanas, uma aba por semana, como o arquivo de hoje.

4. **Sugestão automática a partir das pautas do DEJT**
   - Quando a leitura do DEJT encontrar um processo da Coordenação Dra. Renata Oficial em pauta, ele aparece em "Sugestões da semana".
   - A equipe confirma com um clique, e nada é criado sem essa confirmação.

5. **Ficha do processo**
   - A aba de pautas continua mostrando todas as pautas daquele processo, já com os dados importados.

## Quem pode usar
Membros da Coordenação Dra. Renata Oficial, coordenadores e admin, como já acontece na Distribuição TST.

## Detalhes técnicos
- Tabela `pautas_tst`, com as colunas novas `semana` (texto), `dados_benner_id` e `coordenacao_id`, e um índice único em (dígitos do processo, data_julgamento) para evitar repetição. A segurança da tabela fica igual à de hoje, mais o filtro por coordenação.
- A importação histórica roda uma única vez, no servidor, a partir da planilha enviada. Depois disso, o botão "Importar planilha" da tela passa a aceitar o mesmo formato, para casos pontuais.
- A exportação usa `xlsx`, com cabeçalho fixo de 31 colunas e datas no formato DD/MM/AAAA.
- As sugestões do DEJT fazem o cruzamento das pautas já capturadas com os processos da coordenação. Nenhuma busca nova é feita.
