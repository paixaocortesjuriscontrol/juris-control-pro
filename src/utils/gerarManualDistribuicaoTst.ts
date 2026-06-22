import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

/**
 * Gera um PDF profissional - Manual de Uso da tela Distribuição TST.
 * Cobre cards, filtros, botões, importações (layout Excel), Judit, Kanban, dicas.
 */
export function gerarManualDistribuicaoTst() {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  const primary: [number, number, number] = [37, 99, 235]; // azul
  const dark: [number, number, number] = [30, 41, 59];
  const muted: [number, number, number] = [100, 116, 139];

  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawPageHeader();
    }
  };

  const drawPageHeader = () => {
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal");
    doc.text("Manual - Distribuição TST", margin, 8);
    doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - margin, 8, { align: "right" });
    doc.setDrawColor(220);
    doc.line(margin, 10, pageWidth - margin, 10);
    y = Math.max(y, 16);
  };

  const sectionTitle = (text: string) => {
    ensureSpace(14);
    doc.setFillColor(...primary);
    doc.rect(margin, y, contentWidth, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(text, margin + 3, y + 5.5);
    y += 11;
  };

  const subTitle = (text: string) => {
    ensureSpace(8);
    doc.setTextColor(...primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(text, margin, y);
    y += 5;
  };

  const paragraph = (text: string) => {
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * 4.5 + 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 2;
  };

  const bullets = (items: string[]) => {
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    items.forEach((it) => {
      const lines = doc.splitTextToSize(it, contentWidth - 6);
      ensureSpace(lines.length * 4.5 + 1);
      doc.setTextColor(...primary);
      doc.text("•", margin + 1, y);
      doc.setTextColor(...dark);
      doc.text(lines, margin + 5, y);
      y += lines.length * 4.5 + 0.5;
    });
    y += 1;
  };

  const tip = (text: string) => {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(`Dica: ${text}`, contentWidth - 6);
    const h = lines.length * 4.2 + 4;
    ensureSpace(h + 2);
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.rect(margin, y, contentWidth, h, "FD");
    doc.setTextColor(120, 53, 15);
    doc.text(lines, margin + 3, y + 4);
    y += h + 2;
  };

  const table = (head: string[][], body: string[][]) => {
    autoTable(doc, {
      head,
      body,
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 2, textColor: dark, lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: primary, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: () => { drawPageHeader(); },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 4;
  };

  // ============ CAPA ============
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("Manual de Uso", margin, 30);
  doc.setFontSize(20);
  doc.text("Distribuição TST", margin, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Guia completo da tela, filtros, importações e integrações", margin, 52);

  y = 85;
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Versão do documento: ${format(new Date(), "dd/MM/yyyy")}`, margin, y);
  y += 12;

  subTitle("Sumário");
  bullets([
    "1. Visão geral da tela",
    "2. Cards totalizadores",
    "3. Filtros e pesquisa",
    "4. Botões da barra superior",
    "5. Ações em lote (seleção múltipla)",
    "6. Botão Judit (consulta automática)",
    "7. Marcar Pronto / Enviado / Em Análise / Analisado",
    "8. Cadastro e edição inline",
    "9. Importações via Excel - layouts esperados",
    "10. Kanban de Delegação",
    "11. Carga Benner e Relatórios PDF",
    "12. Dicas de preenchimento e boas práticas",
    "13. Layout detalhado das planilhas (referência completa)",
  ]);

  doc.addPage(); y = margin; drawPageHeader();

  // 1
  sectionTitle("1. Visão geral da tela");
  paragraph(
    "A tela Distribuição TST centraliza todas as distribuições de processos do TST recebidos pelo escritório. " +
    "Cada linha representa um par Processo + Dossiê e concentra dados jurídicos (turma, relator, partes), " +
    "status operacionais (Em análise, Pronto, Enviado) e a integração com a API Judit para enriquecimento automático."
  );
  paragraph(
    "A página foi desenhada para edição inline: praticamente todos os campos da tabela podem ser editados clicando diretamente sobre eles, sem abrir telas separadas."
  );

  // 2
  sectionTitle("2. Cards totalizadores");
  paragraph("Os cards no topo respeitam os filtros aplicados e são clicáveis - clicar em um card filtra a lista para aquele grupo.");
  table(
    [["Card", "O que conta", "Cor"]],
    [
      ["Total", "Todos os registros visíveis nos filtros", "Cinza"],
      ["Em Análise", "Marcados como em_analise = true por algum advogado", "Âmbar"],
      ["Pronto", "status = pronto_envio (aguardando envio para carga)", "Verde"],
      ["Enviado", "status = enviado (já planilhado/transmitido)", "Azul"],
      ["Sem Turma", "Sem turma identificada - exige enriquecimento Judit", "Vermelho"],
      ["Sem Relator", "Falta de relator - geralmente novos cadastros", "Vermelho"],
      ["Problema Judit", "Última consulta Judit retornou erro ou sem dados", "Laranja"],
      ["Duplicados", "Mesmo Processo+Dossiê cadastrado mais de uma vez", "Roxo"],
    ]
  );
  tip("Clique no card de novo para limpar aquele filtro específico.");

  // 3
  sectionTitle("3. Filtros e pesquisa");
  paragraph("Todos os filtros se combinam (AND). O campo Pesquisa por Processo aceita número com ou sem máscara - basta digitar os números do CNJ.");
  table(
    [["Filtro", "Como usar"]],
    [
      ["Aba de origem", "Seleciona a aba/planilha em que o registro foi importado (ex.: 'Distribuição TST')."],
      ["Status Benner", "Filtra Benner SIM/NÃO conforme conferência."],
      ["Processo / Dossiê", "Busca parcial. Aceita CNJ com ou sem pontos."],
      ["Status do Dossiê", "Localizado, Não localizado, etc."],
      ["Turma / Relator", "Busca parcial pelo nome."],
      ["Parte / Nome da Parte", "Busca em parties_detail vindo da Judit."],
      ["Data início / fim", "Período de distribuição."],
      ["Mês/Ano", "Atalho de período por competência."],
      ["Judit", "Filtra por status do enriquecimento (com dados, sem dados, com erro)."],
      ["Em Análise", "Em análise / Pronto / Analisado / Todos."],
      ["Situação do Processo", "Trânsito em julgado, Em andamento, etc."],
      ["Subida em Massa", "Identifica lotes de subida coletiva."],
      ["Responsáveis", "Filtra pelos advogados delegados (múltipla seleção)."],
      ["Fonte de Importação", "Planilha Master, Certidão PDF, manual, etc."],
      ["Provas Digitais", "Sim / Não."],
      ["Situação Envio Carga", "Lista cadastrada em Configurações."],
    ]
  );
  tip("O filtro 'Analisado' só mostra registros que já foram revisados após estarem em análise - usados para auditoria.");

  // 4
  sectionTitle("4. Botões da barra superior");
  table(
    [["Botão", "Função"]],
    [
      ["M. Instruções", "Gera este PDF explicativo (Manual de Instruções - você está lendo agora)."],
      ["Relatório PDF Partes", "Gera PDF com polo ativo e passivo dos processos filtrados (ou selecionados)."],
      ["Certidão TST (PDF)", "Importa certidão oficial em PDF e cria/atualiza registros."],
      ["Importar (Excel)", "Importa a planilha mestre de distribuição TST."],
      ["Atualizar Dossiês", "Atualiza coluna Dossiê em massa por Processo."],
      ["Atualizar Equipe", "Atualiza responsáveis em massa via planilha."],
      ["Atualizar Situação Envio", "Atualiza coluna Situação Envio Carga em massa (apenas admin)."],
      ["Dados Benner", "Vai para a tela completa de Dados Benner."],
      ["Kanban Delegação", "Vista Kanban (Delegada / Em andamento / Finalizada)."],
      ["Benner SIM", "Marca Benner=SIM via planilha de conferência."],
      ["Dossiês Não Localizados", "Exporta planilha dos dossiês não encontrados."],
      ["Gerar Carga Benner", "Gera o arquivo XLSX padronizado para upload no Benner."],
      ["Novo (+)", "Cadastro manual de um novo registro."],
      ["Delegar", "Atribui advogados responsáveis aos selecionados."],
      ["Distribuir Automático", "Distribui pendentes igualmente entre advogados."],
    ]
  );

  // 5
  sectionTitle("5. Ações em lote (seleção múltipla)");
  paragraph("Marque os checkboxes da tabela para habilitar as ações em lote. O contador aparece próximo aos botões.");
  bullets([
    "Marcar Pronto: muda status para 'pronto_envio'. Se estava 'em análise', muda automaticamente para 'Analisado'.",
    "Marcar Enviado: muda status para 'enviado' (depois da carga subir no Benner).",
    "Preencher com Judit: dispara consulta em lote (use 'com anexos' apenas quando necessário - consome quota).",
    "Excluir: somente admin/coordenador.",
    "Delegar: abre diálogo para escolher responsáveis dos selecionados.",
  ]);
  tip("Use 'Limpar seleção' (botão ghost) para zerar a seleção rapidamente.");

  // 6
  sectionTitle("6. Botão Judit (consulta automática)");
  paragraph(
    "A integração Judit busca metadados oficiais do processo (turma, relator, partes, movimentações). " +
    "Pode ser acionada individualmente em cada linha (ícone Judit) ou em lote pelo botão 'Preencher com Judit'."
  );
  bullets([
    "Sem anexos (padrão): apenas metadados - resposta rápida e barata.",
    "Com anexos: também baixa documentos do processo - consulta cara, usar com critério.",
    "Erros são marcados na coluna 'Erro Judit' e podem ser filtrados.",
    "O sistema deduplica anexos por hash para não baixar o mesmo documento duas vezes.",
  ]);
  tip("Se um processo voltar 'sem turma', tente reconsultar - o tribunal pode ter publicado a distribuição depois.");

  // 7
  sectionTitle("7. Marcar Pronto / Enviado / Em Análise / Analisado");
  table(
    [["Estado", "Significado", "Como entrar"]],
    [
      ["Em Análise", "Advogado está revisando", "Botão 'Em análise' na linha"],
      ["Analisado", "Foi para Pronto saindo de Em Análise", "Automático ao marcar Pronto"],
      ["Pronto (pronto_envio)", "Pronto para entrar na próxima carga", "Botão 'Marcar Pronto' (lote)"],
      ["Enviado", "Carga já transmitida ao Benner", "Botão 'Marcar Enviado'"],
    ]
  );

  // 8
  sectionTitle("8. Cadastro e edição inline");
  paragraph(
    "Quase todas as colunas editáveis aceitam clique direto: turma, relator, situação, dossiê, observações, responsáveis. " +
    "Não há botão 'Editar' - a alteração é salva ao sair do campo."
  );
  bullets([
    "Para criar do zero, clique em 'Novo' (+) - abre o formulário completo.",
    "Para editar tudo de um registro, clique no número do processo.",
    "Mudanças aparecem destacadas por alguns segundos para localização visual.",
  ]);

  // 9
  sectionTitle("9. Importações via Excel - layouts esperados");
  subTitle("9.1 Importar Distribuição TST (planilha mestre)");
  paragraph("O sistema varre todas as abas da planilha. Cabeçalhos são detectados dinamicamente nas primeiras linhas.");
  table(
    [["Coluna esperada", "Obrigatório", "Observação"]],
    [
      ["Processo", "Sim", "CNJ com ou sem máscara"],
      ["Dossiê", "Sim", "Identificador interno Benner"],
      ["Turma", "Não", "Será preenchida pela Judit se ausente"],
      ["Relator", "Não", "Preenchida pela Judit se ausente"],
      ["Recorrente / Recorrido", "Não", "Partes para conferência rápida"],
      ["Data Distribuição", "Não", "Formato DD/MM/AAAA"],
      ["Situação", "Não", "Trânsito em Julgado, Em andamento, etc."],
      ["Observação", "Não", "Texto livre"],
    ]
  );
  tip("A aba é registrada em 'aba_origem' - use isso depois para filtrar lotes específicos.");

  subTitle("9.2 Atualizar Dossiês");
  table(
    [["Coluna", "Uso"]],
    [["Processo", "Chave de busca (CNJ)"], ["Dossiê", "Novo valor a gravar"]]
  );

  subTitle("9.3 Atualizar Equipe");
  table(
    [["Coluna", "Uso"]],
    [
      ["A - Processo", "Informativo (CNJ, com ou sem máscara)"],
      ["B - Dossiê", "Chave de busca em dados_benner.dossie"],
      ["C - Equipe", "Nome da equipe/advogado responsável"],
    ]
  );
  tip("O prefixo 'Jurídico Trabalhista - ' é removido automaticamente do nome da equipe.");

  subTitle("9.4 Benner SIM (conferência)");
  table(
    [["Coluna", "Uso"]],
    [["Dossiê", "Chave"], ["Processo", "Apoio"], ["Benner", "Marca SIM/NÃO"]]
  );

  subTitle("9.5 Atualizar Situação Envio Carga (admin)");
  table(
    [["Coluna", "Uso"]],
    [["Processo / Dossiê", "Chave"], ["Situação Envio", "Texto da lista configurada"]]
  );

  // 10
  sectionTitle("10. Kanban de Delegação");
  paragraph(
    "O botão 'Kanban Delegação' abre uma visão por colunas (Delegada / Em andamento / Finalizada) " +
    "dos processos que possuem distribuído_em preenchido. Os filtros por advogado, status e aba se mantêm."
  );
  bullets([
    "Clique em 'Alterar situação' no card para mudar de coluna ou adicionar observação.",
    "O resumo por responsável mostra Total / Pronto / Faltam e percentual concluído.",
    "Use 'Ver meus processos' para focar apenas nos seus.",
  ]);

  // 11
  sectionTitle("11. Carga Benner e Relatórios PDF");
  bullets([
    "Gerar Carga Benner: produz XLSX no layout oficial. Respeita filtros ou seleção. Dossiês inválidos vão para 'Rejeicoes_Carga_Benner.xlsx'.",
    "Relatório PDF Partes: lista polo ativo e passivo de cada processo (a partir dos dados Judit).",
    "Dossiês Não Localizados: planilha auxiliar para o time de TI/Benner localizar pendências.",
  ]);

  // 12
  sectionTitle("12. Dicas de preenchimento e boas práticas");
  bullets([
    "Sempre rode a Judit em lote logo após importar uma nova carga - reduz 'Sem Turma' e 'Sem Relator'.",
    "Antes de marcar Pronto, confira Turma, Relator e Situação - depois é mais difícil corrigir.",
    "Use o filtro 'Em Análise' para retomar de onde parou no dia seguinte.",
    "Use 'Analisado' em auditoria para ver tudo que passou pela revisão.",
    "Evite usar 'Com anexos' em lotes grandes - consome quota Judit; ative só quando precisar dos PDFs.",
    "Mantenha a aba de origem padronizada na hora de importar (ajuda a filtrar lotes depois).",
    "Para dossiês com '/', o sistema sempre aceita - não tente normalizar manualmente.",
    "Datas em planilhas devem ser DD/MM/AAAA - exportações já saem nesse padrão.",
  ]);

  // 13 - Capítulo novo: layout detalhado de cada planilha lida pela tela
  doc.addPage(); y = margin; drawPageHeader();
  sectionTitle("13. Layout detalhado das planilhas (referência completa)");
  paragraph(
    "Este capítulo descreve, para cada botão da tela que lê uma planilha, o formato esperado do arquivo: " +
    "abas processadas, como o cabeçalho é localizado, quais colunas são obrigatórias e qual é o comportamento " +
    "após a leitura. Use como referência ao montar planilhas novas ou diagnosticar uma importação que não traz dados."
  );
  tip("Em todos os botões, o sistema aceita .xlsx e .xls. Datas devem estar em DD/MM/AAAA ou como data nativa do Excel.");

  // 13.1
  subTitle("13.1 Importar (Excel) - Planilha mestre de Distribuição TST");
  paragraph(
    "Lê TODAS as abas do arquivo. O cabeçalho é detectado nas 10 primeiras linhas de cada aba procurando uma " +
    "célula que contenha 'Número' + 'Processo' OU 'Dossiê'. A partir do cabeçalho encontrado, o sistema usa " +
    "POSIÇÕES FIXAS de coluna (A a AB) - a ordem importa."
  );
  table(
    [["Coluna (Excel)", "Índice", "Campo", "Obs."]],
    [
      ["A", "0", "Data da distribuição", "DD/MM/AAAA ou Date nativo"],
      ["B", "1", "Número do processo (CNJ)", "Obrigatório, ≥ 7 caracteres"],
      ["C", "2", "Dossiê", "Identificador Benner"],
      ["D", "3", "Equipe", "Texto livre"],
      ["E", "4", "Reclamante (polo ativo)", ""],
      ["F", "5", "Reclamada (polo passivo)", ""],
      ["G", "6", "Relator (nome)", ""],
      ["H", "7", "Posicionamento do Relator", "'positivo' / 'negativo'"],
      ["I", "8", "Turma (nome)", ""],
      ["J", "9", "Posicionamento da Turma", "'positivo' / 'negativo'"],
      ["K", "10", "Recorrente", ""],
      ["L", "11", "Tipo recurso reclamante", ""],
      ["M", "12", "Matérias recurso reclamante", ""],
      ["N", "13", "Aparelhamento reclamante", ""],
      ["O", "14", "Chance êxito reclamante", ""],
      ["P", "15", "Tipo recurso banco", ""],
      ["Q", "16", "Matérias recurso banco", ""],
      ["R", "17", "Aparelhamento banco", ""],
      ["S", "18", "Chance êxito banco", ""],
      ["T", "19", "Honra", ""],
      ["U", "20", "Tema", ""],
      ["V", "21", "Execução", ""],
      ["W", "22", "Mídia negativa", ""],
      ["X", "23", "Decisão quarteirizado", ""],
      ["Y", "24", "Recurso de terceiros", ""],
      ["Z", "25", "Trânsito em julgado", "S/SIM/X/TRUE = true"],
      ["AA", "26", "Benner atualizado", "S/SIM/X/TRUE = true"],
      ["AB", "27", "Responsável (advogado)", "Apelido/nome - resolvido na coord. Dra. Renata"],
    ]
  );
  bullets([
    "Nome da aba é gravado em 'aba_origem' - serve depois para filtrar lotes.",
    "Cada linha vira um registro em dados_benner; duplicados (mesmo processo) ficam marcados com ic_duplicado=true.",
    "Processos novos são criados em 'processos'; existentes têm Dossiê, Relator e Turma atualizados.",
    "Registros antigos com judit_preenchido=true são preservados; demais são substituídos pela nova carga.",
  ]);

  // 13.2
  subTitle("13.2 Atualizar Dossiês");
  paragraph("Lê apenas a PRIMEIRA aba. Cabeçalho detectado nas 10 primeiras linhas por NOME (qualquer ordem/posição).");
  table(
    [["Cabeçalho aceito (case-insensitive)", "Significado", "Obrigatório"]],
    [
      ["Contém 'dossi' (ex.: 'Nº Do Dossiê', 'Dossiê')", "Novo dossiê", "Sim"],
      ["'Número' ou 'Numero'", "Número do processo (CNJ)", "Sim"],
    ]
  );
  bullets([
    "Linhas só são consideradas se Processo tiver ≥ 7 caracteres E Dossiê estiver preenchido.",
    "Atualiza dados_benner.dossie em lotes de 500. NÃO cria registros novos - processos não encontrados são contados como 'não encontrados'.",
  ]);

  // 13.3
  subTitle("13.3 Atualizar Equipe");
  paragraph(
    "Lê TODAS as abas. Usa POSIÇÕES FIXAS (não detecta cabeçalho por nome): coluna A = Processo, " +
    "coluna B = Dossiê (chave) e coluna C = Equipe. O cabeçalho é localizado nas 10 primeiras linhas " +
    "apenas para pular linhas de título."
  );
  table(
    [["Coluna", "Índice", "Campo"]],
    [
      ["A", "0", "Processo (CNJ) - informativo, não é usado como chave"],
      ["B", "1", "Dossiê (chave de busca em dados_benner.dossie)"],
      ["C", "2", "Equipe / nome do advogado responsável"],
    ]
  );
  bullets([
    "O prefixo 'Jurídico Trabalhista - ' é removido automaticamente do nome da equipe.",
    "Linhas em branco (sem Dossiê OU sem Equipe) são ignoradas.",
    "Faz UPDATE em lotes de 500 por dossiê.",
  ]);

  // 13.4
  subTitle("13.4 Benner SIM");
  paragraph(
    "Lê TODAS as abas. Detecta cabeçalho por NOME nas 10 primeiras linhas. NÃO existe coluna 'Benner SIM/NÃO' " +
    "na planilha - o sistema apenas usa a lista de processos para MARCAR benner_sim=true em todos os registros encontrados."
  );
  table(
    [["Cabeçalho aceito", "Significado", "Obrigatório"]],
    [
      ["'Número do Processo' / 'Número' / 'Nº Processo' / 'N. Processo'", "Processo (CNJ)", "Sim"],
      ["'Dossiê' / 'Dossie'", "Dossiê Benner", "Sim"],
      ["Contém 'Data' + 'Distrib'", "Data de distribuição", "Não"],
      ["Contém 'Reclamante'", "Polo ativo", "Não"],
    ]
  );
  bullets([
    "Processos repetidos na planilha são deduplicados; preserva a linha que tem Dossiê preenchido.",
    "Cria registros novos em dados_benner caso o processo não exista; existentes são apenas marcados.",
  ]);

  // 13.5
  subTitle("13.5 Atualizar Situação Envio Carga (apenas admin)");
  paragraph("Lê apenas a PRIMEIRA aba. Detecta cabeçalho por NOME nas 10 primeiras linhas.");
  table(
    [["Cabeçalho aceito", "Significado", "Obrigatório"]],
    [
      ["'Processo' (exato)", "Número do processo (CNJ)", "Sim"],
      ["Contém 'Tipo' + 'Carga' OU 'Situa' + 'Envio'", "Código/descrição da situação", "Sim"],
      ["'Dossiê' / 'Dossie' / começa com 'dossi'", "Dossiê", "Não (usado p/ desambiguação)"],
    ]
  );
  bullets([
    "A coluna de situação aceita o código da lista cadastrada em Configurações > Situações Envio Carga.",
    "Códigos não cadastrados são contados em 'sem código' e ignorados (o admin precisa cadastrá-los antes).",
    "Processos não encontrados em 'processos' são listados no resumo final.",
  ]);

  // 13.6
  subTitle("13.6 Resposta Santander (importar respostas)");
  paragraph(
    "Lê TODAS as abas. Cabeçalho detectado por NOME (qualquer ordem). Aceita ~30 colunas opcionais; apenas " +
    "Processo e Dossiê são chaves obrigatórias. Algumas colunas posicionais são fixas (B, C, N, P)."
  );
  table(
    [["Grupo", "Cabeçalhos aceitos (contém)", "Obs."]],
    [
      ["Chaves", "'Processo', 'Número do Processo', 'Nº Processo'", "Obrigatório"],
      ["Dossiê", "'Dossiê' / 'Dossie' (também posição B fixa)", "Obrigatório"],
      ["Centralizador", "'Centralizador' (posição C fixa)", "Aceita vazio, '0' ou contendo 'Paixão'"],
      ["Local", "'Comarca', 'Juízo', 'UF' / 'Estado'", "Opcional"],
      ["Classificação", "'Objeto', 'Assunto', 'Categoria', 'Subcategoria'", "Opcional"],
      ["Turma / Relator", "'Turma' / 'Turma TST', 'Relator' / 'Ministro Relator'", "Texto"],
      ["Data distribuição", "Contém 'Data' + 'Distribui'", "DD/MM/AAAA"],
      ["Posicionamento Turma", "'Turma' + ('favorável'/'positivo' OU 'desfavorável'/'negativo')", "Booleano"],
      ["Posicionamento Relator", "'Relator' + ('favorável'/'positivo' OU 'desfavorável'/'negativo')", "Booleano"],
      ["Aparelhamento", "'bem aparelhado' / 'mal aparelhado'", "Booleano"],
      ["Chance de êxito", "'Chance' + 'êxito' + (S) ou (N)", "Booleano"],
      ["Resultado", "'Sem transcendência', 'Conhecido e provido', 'Não conhecido' etc.", "Booleano por coluna"],
      ["Ganhamos / Perdemos", "'Ganhamos', 'Perdemos'", "Booleano"],
      ["Tipo recurso (posição N)", "Texto do recurso, distribuído por col P", "Posicional"],
      ["Parte do recurso (posição P)", "Contém 'Reclamante' / 'Reclamada' para classificar N", "Posicional"],
    ]
  );
  bullets([
    "Linhas com centralizador diferente de vazio/'0'/'Paixão' são ignoradas.",
    "O tipo de recurso 'incidente de superação e revisão dos precedentes' é descartado.",
    "O tipo de recurso da col N é jogado em 'banco' OU 'reclamante' de acordo com o texto da col P.",
  ]);

  tip(
    "Diferença importante: 'Importar (Excel)', 'Atualizar Equipe' e 'Benner SIM' leem TODAS as abas; " +
    "'Atualizar Dossiês' e 'Atualizar Situação Envio' leem só a PRIMEIRA. Quando precisar consolidar várias abas, "+
    "use os primeiros."
  );

  // Rodapé final
  ensureSpace(20);
  y += 6;
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...muted);
  doc.text(
    "Documento gerado automaticamente pelo sistema. Em caso de dúvidas, contate a coordenação.",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  doc.save(`Manual_Distribuicao_TST_${format(new Date(), "yyyy-MM-dd")}.pdf`);
}