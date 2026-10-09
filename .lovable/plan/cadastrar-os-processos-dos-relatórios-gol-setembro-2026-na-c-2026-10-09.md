# Cadastrar os processos dos relatórios GOL (setembro/2026) na Coordenação GOL

## O que as planilhas têm
| Planilha | Aba | Linhas |
|---|---|---|
| GOL – Operação | OPERAÇÃO | 8.690 (72 colunas) |
| WEBJET | WEBJET | 621 (65 colunas) |
| Sucessão | ATIVOS | 283 |
| Sucessão | ENCERRADOS | 4 |
| Sucessão | NOVOS | 0 (vazia) |
| Sucessão | ENCERRADO PROVISORIAMENTE | 840 |
| Sucessão | Empregados VRG com ação | 120 |

Total de cerca de 10.560 linhas. Algumas usam número antigo, como "00933.2008.003.08.00-8" ou "02204-2008-315-02-00-3". Nesses casos, o número será convertido para o padrão atual. Se não for possível, será mantido como está.

## Campos que já existem na ficha
Número, dossiê, reclamante, reclamadas, empresa terceirizada, UF, comarca, vara, data de distribuição, data de admissão e demissão, cargo/função, pedidos/objeto, fase, valor da causa, provisionamento remoto/possível/provável, prognóstico (risco), trânsito em julgado, data de encerramento, observações, CPF da parte contrária, auto de infração, valor de condenação e situação.

## Campos que não existem e serão criados
Os campos novos ficam em uma nova aba **"Relatório do cliente"**, abaixo de Visão Geral, na ficha do processo. São editáveis direto na tela, sem botão Editar:
- **Classificação:** tipo de demanda, tese, é técnico, população, classificação Aerotech, população AJ, outras terceiras, periculosidade, processo estratégico, processo limpo, caso ABRA, verificação GOL 4T2025, observações PCA, assédio (envolvidos), resultado do laudo pericial.
- **Advogado da parte:** nome e OAB.
- **Números:** provisório e coletivo.
- **Acordo:** sim/não e data.
- **Sentença, acórdão TRT e acórdão TST:** data, resultado, resultado ajustado e magistrado de cada um.
- **Garantias:** RO, AIRO, RR e AIRR.
- **Cálculos:** da reclamada, do reclamante e do perito, com datas, e cálculo homologado.
- **Pendente no TST:** sim/não e data de distribuição no TST.
- **Sucessão:** sentença e acórdão reconhecendo a sucessão, execução, inclusão em execução, conflito de competência, GOL excluída, valores na vara empresarial e na vara do trabalho, status da devolução de valores, habilitação falimentar, justificativa de contingência, contingência, pedidos deferidos ao final, execução provisória, lote/obs.
- **Empregados VRG:** rito, natureza, filtro do cliente, histórico do contrato e cálculo elaborado.
- **Relatório de origem** (Operação, Webjet ou Sucessão – aba), para filtrar e exportar.

## Como será o cadastro
1. **Conferir o que já existe:** os números serão comparados com a base usando só os dígitos. Processos já cadastrados não serão duplicados. Neles, só os campos vazios serão preenchidos, e nada já preenchido será sobrescrito.
2. **Cadastrar os novos** na Coordenação GOL, com cliente GOL LINHAS AÉREAS S.A. Os da planilha Webjet ficam com a parte ré informada nela. Todos entram como área trabalhista.
3. **Definir a situação:**
   - Encerrados ou com data de encerramento: **encerrado**.
   - Encerrado Provisoriamente: **arquivado provisoriamente**.
   - Demais: **ativo**.
4. **Processos que pertencem a outra coordenação**, como a Execução GOL da Dra. B. Anjos, não mudam de coordenação. Eles recebem a Coordenação GOL como coordenação responsável adicional.
5. **Linhas repetidas** entre abas ou planilhas viram uma única ficha, com os dados das duas combinados.
6. Sem consulta à Judit, para não gerar custo. Só os dados das planilhas serão usados.
7. **Conferência final** com relatório Excel: novos, já existentes, atualizados, números inválidos e totais por aba.

## Pontos de atenção
- Células com erro na planilha, como "#NAME?" e "#VALUE!", ficam em branco.
- Os responsáveis não são definidos, porque as planilhas não têm coluna de responsável.

## Detalhes técnicos
- Migração: novas colunas em `processos` (texto/data/numérico conforme o campo) e `relatorio_origem`. Sem tabela nova; RLS atual é mantida.
- Novo componente de aba na ficha (`ProcessoDetalhes`), seguindo o padrão de edição inline.
- Importação via função temporária em lotes, comparando por dígitos (`find_processo_by_digits`). Inclusão em `processos_coordenacoes_responsaveis` com `ON CONFLICT DO NOTHING`. Coordenação GOL `f5a0ac48-…`.
