import jsPDF from "jspdf";

type Bloco =
  | { tipo: "titulo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "passos"; itens: string[] }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "aviso"; texto: string };

const CONTEUDO: Bloco[] = [
  {
    tipo: "paragrafo",
    texto:
      "Este manual explica como cadastrar processos e casos, como usar o número CNJ com a integração Judit para preencher o formulário automaticamente e como navegar pelas abas laterais da tela de detalhe do processo.",
  },
  { tipo: "titulo", texto: "1. Visão geral da tela Processos e Casos" },
  {
    tipo: "paragrafo",
    texto:
      "A tela lista todos os processos e casos visíveis para você, com filtros de busca, área, situação, coordenação e etiquetas. Os cartões podem ser expandidos para ver dados resumidos e a lista lateral mostra prazos, tarefas e eventos vinculados.",
  },
  {
    tipo: "lista",
    itens: [
      "Buscar: digite número CNJ, cliente ou parte para filtrar a lista.",
      "Filtros: área (Cível, Trabalhista, Empresarial, Caso), situação e coordenação.",
      "Exportar: gera planilha Excel com os processos filtrados.",
      "Novo Processo: cadastro com número CNJ.",
      "Novo Caso: cadastro sem número (o CNJ pode ser incluído depois).",
      "Manual PDF: gera este documento.",
    ],
  },
  { tipo: "titulo", texto: "2. Cadastrando um novo processo pelo número CNJ" },
  {
    tipo: "paragrafo",
    texto:
      "O caminho mais rápido para cadastrar é digitar o número do processo e deixar a Judit preencher o restante do formulário.",
  },
  {
    tipo: "passos",
    itens: [
      "Clique em Novo Processo no topo da tela.",
      "No campo Número do Processo, digite apenas os dígitos: a máscara CNJ é aplicada automaticamente (0000000-00.0000.0.00.0000).",
      "Confira se o número ficou completo (20 dígitos). Números incompletos impedem a consulta.",
      "Clique no botão Judit ao lado do número do processo.",
      "Aguarde o retorno (normalmente poucos segundos, pois a consulta usa cache).",
      "Revise os campos preenchidos e ajuste o que for necessário.",
      "Selecione o cliente, a coordenação responsável e o advogado responsável.",
      "Clique em Salvar.",
    ],
  },
  { tipo: "subtitulo", texto: "O que a Judit preenche" },
  {
    tipo: "lista",
    itens: [
      "Tribunal, justiça, instância, órgão julgador, vara, comarca e UF.",
      "Classe, assunto, matéria e natureza do processo.",
      "Polo ativo e polo passivo (reclamante e reclamados) e partes envolvidas.",
      "Data de distribuição e valor da causa, quando disponíveis.",
      "Andamentos (movimentações) do processo, gravados sem duplicar o que já existe.",
      "Relator e turma, quando o processo estiver em instância superior.",
    ],
  },
  {
    tipo: "aviso",
    texto:
      "A Judit preenche apenas campos vazios: informações digitadas manualmente não são sobrescritas, exceto o Tipo de Recurso, que só é considerado válido quando confirmado por andamento da Judit.",
  },
  { tipo: "subtitulo", texto: "Dados sempre atuais e cache do dia" },
  {
    tipo: "paragrafo",
    texto:
      "Cada clique no botão Judit faz uma consulta atualizada no tribunal (mais lenta, de 8 a 30 segundos). A única exceção é quando o mesmo processo já foi consultado com sucesso no mesmo dia: nesse caso o sistema reaproveita o resultado do dia, respondendo na hora e sem novo custo. Consultas de dias anteriores nunca são reaproveitadas. Use Forçar atualização para ignorar até o resultado do dia.",
  },

  { tipo: "subtitulo", texto: "Consulta com anexos" },
  {
    tipo: "paragrafo",
    texto:
      "Por padrão a consulta é feita sem anexos, para economizar consumo. Quando você marca a opção de anexos, os documentos são baixados e indexados, ficando disponíveis na aba Análise Judit.",
  },
  { tipo: "titulo", texto: "3. Novo Caso (sem número de processo)" },
  {
    tipo: "paragrafo",
    texto:
      "Use Novo Caso para atendimentos consultivos ou pré-processuais. O número CNJ é opcional; o sistema gera um identificador temporário. Quando o processo for distribuído, abra o caso, informe o número e clique em Judit para completar os dados.",
  },
  { tipo: "titulo", texto: "4. Abas laterais do formulário de detalhe" },
  {
    tipo: "paragrafo",
    texto:
      "Ao abrir um processo, o menu lateral esquerdo organiza as informações em grupos. No desktop o menu é vertical; no celular ele vira uma barra com rolagem horizontal. Os números ao lado de cada aba indicam a quantidade de itens.",
  },
  { tipo: "subtitulo", texto: "Visão geral" },
  {
    tipo: "lista",
    itens: [
      "Visão Geral: dados cadastrais do processo, com edição direta no próprio campo (não há botão Editar).",
      "Auditoria: histórico completo de alterações, com nome e e-mail de quem realizou cada ação, incluindo tarefas vinculadas.",
    ],
  },
  { tipo: "subtitulo", texto: "Prazos & Eventos" },
  {
    tipo: "lista",
    itens: [
      "Tarefa: tarefas sem prazo fatal vinculadas ao processo.",
      "Evento: compromissos de agenda.",
      "Prazo: prazos com data fatal, base dos alertas e do ranking de atendimento.",
      "Audiência: audiências detectadas ou cadastradas manualmente.",
      "Parcelamento recorrente: lançamentos repetidos de acordos e pagamentos.",
    ],
  },
  { tipo: "subtitulo", texto: "Andamentos" },
  {
    tipo: "lista",
    itens: [
      "Andamentos: movimentações do processo, incluindo as gravadas pela Judit.",
      "Pub. DJEN: publicações capturadas no monitoramento do Diário Eletrônico.",
      "Redistribuições: mudanças de órgão julgador identificadas nos andamentos.",
    ],
  },
  { tipo: "subtitulo", texto: "Documentos, Pedidos e Financeiro" },
  {
    tipo: "lista",
    itens: [
      "Pasta: documentos anexados ao processo, inclusive os baixados pela Judit.",
      "Pedidos: pedidos da inicial, usados na análise de risco.",
      "Cobrança: valores, provisão e controle financeiro do processo.",
    ],
  },
  { tipo: "subtitulo", texto: "Monitoramento" },
  {
    tipo: "lista",
    itens: [
      "Análise Judit: anexos indexados, leitura por IA e preenchimento assistido de campos.",
      "Partes: partes e advogados do processo, com documentos e polos.",
    ],
  },
  { tipo: "subtitulo", texto: "Distribuições e Interação" },
  {
    tipo: "lista",
    itens: [
      "Distribuições: vínculo com a base de Distribuição TST.",
      "Comentários: registro de tratativas, com menções usando @ para notificar colegas.",
    ],
  },
  { tipo: "titulo", texto: "5. Boas práticas" },
  {
    tipo: "lista",
    itens: [
      "Sempre confira o número CNJ antes de consultar a Judit: um dígito errado traz outro processo.",
      "Prefira a consulta normal (cache) e reserve Forçar atualização para casos urgentes.",
      "Revise polo ativo e passivo antes de salvar: eles alimentam o monitoramento do DJEN.",
      "Preencha a coordenação responsável, pois ela define quem recebe alertas e enxerga os prazos.",
      "Um mesmo processo pode ter várias coordenações responsáveis; prazos e eventos são filtrados pela coordenação do usuário logado.",
    ],
  },
];

export function construirManualProcessosPdf(): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 48;
  const larguraTexto = largura - margem * 2;
  let y = margem;
  let pagina = 1;

  const rodape = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text("Juris Control — Paixão Cortes Advogados", margem, altura - 24);
    doc.text(`Página ${pagina}`, largura - margem, altura - 24, { align: "right" });
    doc.setTextColor(0);
  };

  const novaPagina = () => {
    rodape();
    doc.addPage();
    pagina += 1;
    y = margem;
  };

  const garantirEspaco = (h: number) => {
    if (y + h > altura - 56) novaPagina();
  };

  const escrever = (
    texto: string,
    opts: { size: number; style?: "normal" | "bold"; recuo?: number; cor?: number[]; espacoDepois?: number },
  ) => {
    const recuo = opts.recuo ?? 0;
    doc.setFont("helvetica", opts.style ?? "normal");
    doc.setFontSize(opts.size);
    doc.setTextColor(opts.cor?.[0] ?? 30, opts.cor?.[1] ?? 30, opts.cor?.[2] ?? 30);
    const linhas = doc.splitTextToSize(texto, larguraTexto - recuo) as string[];
    const lh = opts.size * 1.4;
    for (const linha of linhas) {
      garantirEspaco(lh);
      doc.text(linha, margem + recuo, y);
      y += lh;
    }
    y += opts.espacoDepois ?? 6;
    doc.setTextColor(30);
  };

  // Capa
  doc.setFillColor(23, 37, 84);
  doc.rect(0, 0, largura, 150, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255);
  doc.text("Manual — Processos e Casos", margem, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Cadastro por número CNJ, preenchimento com Judit e abas do processo", margem, 102);
  doc.setFontSize(9);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    margem,
    124,
  );
  doc.setTextColor(30);
  y = 190;

  for (const bloco of CONTEUDO) {
    switch (bloco.tipo) {
      case "titulo":
        garantirEspaco(46);
        y += 8;
        escrever(bloco.texto, { size: 14, style: "bold", cor: [23, 37, 84], espacoDepois: 4 });
        doc.setDrawColor(210);
        doc.line(margem, y - 2, largura - margem, y - 2);
        y += 8;
        break;
      case "subtitulo":
        garantirEspaco(30);
        y += 4;
        escrever(bloco.texto, { size: 11.5, style: "bold", espacoDepois: 4 });
        break;
      case "paragrafo":
        escrever(bloco.texto, { size: 10.5, espacoDepois: 8 });
        break;
      case "lista":
        bloco.itens.forEach((item) => {
          garantirEspaco(16);
          doc.setFillColor(23, 37, 84);
          doc.circle(margem + 4, y - 3, 2, "F");
          escrever(item, { size: 10.5, recuo: 16, espacoDepois: 2 });
        });
        y += 6;
        break;
      case "passos":
        bloco.itens.forEach((item, i) => {
          garantirEspaco(18);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10.5);
          doc.setTextColor(23, 37, 84);
          doc.text(`${i + 1}.`, margem, y);
          doc.setTextColor(30);
          escrever(item, { size: 10.5, recuo: 20, espacoDepois: 2 });
        });
        y += 6;
        break;
      case "aviso": {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        const linhas = doc.splitTextToSize(bloco.texto, larguraTexto - 32) as string[];
        const h = linhas.length * 14 + 20;
        garantirEspaco(h + 10);
        doc.setFillColor(255, 249, 224);
        doc.setDrawColor(240, 200, 90);
        doc.roundedRect(margem, y - 12, larguraTexto, h, 4, 4, "FD");
        let yy = y + 4;
        linhas.forEach((l) => {
          doc.text(l, margem + 14, yy);
          yy += 14;
        });
        y = y + h + 4;
        break;
      }
    }
  }

  rodape();
  return doc;
}

export function gerarManualProcessosPdf() {
  const doc = construirManualProcessosPdf();
  doc.save(`Manual_Processos_e_Casos_${new Date().toISOString().slice(0, 10)}.pdf`);
}
