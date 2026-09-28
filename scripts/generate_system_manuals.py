from pathlib import Path
from xml.sax.saxutils import escape
import subprocess

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "manuais"
OUT.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#111B34")
NAVY_2 = colors.HexColor("#1A294C")
GOLD = colors.HexColor("#D9A91C")
GOLD_LIGHT = colors.HexColor("#F5E6A8")
INK = colors.HexColor("#202738")
MUTED = colors.HexColor("#667085")
LIGHT = colors.HexColor("#F4F6FA")
LINE = colors.HexColor("#D8DEE9")
WHITE = colors.white
GREEN = colors.HexColor("#176B45")
RED = colors.HexColor("#A53030")


def font_path(pattern: str) -> str:
    return subprocess.check_output(["fc-match", "-f", "%{file}", pattern], text=True).strip()


pdfmetrics.registerFont(TTFont("Sans", font_path("DejaVu Sans")))
pdfmetrics.registerFont(TTFont("Sans-Bold", font_path("DejaVu Sans:bold")))
pdfmetrics.registerFont(TTFont("Serif", font_path("Liberation Serif")))
pdfmetrics.registerFont(TTFont("Serif-Bold", font_path("Liberation Serif:bold")))


styles = getSampleStyleSheet()
S = {
    "chapter": ParagraphStyle("Chapter", fontName="Sans-Bold", fontSize=9, leading=12, textColor=GOLD, spaceAfter=4),
    "h1": ParagraphStyle("H1", fontName="Serif-Bold", fontSize=23, leading=28, textColor=NAVY, spaceAfter=7),
    "h2": ParagraphStyle("H2", fontName="Sans-Bold", fontSize=14, leading=18, textColor=NAVY_2, spaceBefore=8, spaceAfter=5),
    "h3": ParagraphStyle("H3", fontName="Sans-Bold", fontSize=10.5, leading=14, textColor=NAVY, spaceBefore=5, spaceAfter=3),
    "body": ParagraphStyle("Body", fontName="Sans", fontSize=9.2, leading=14, textColor=INK, spaceAfter=5),
    "small": ParagraphStyle("Small", fontName="Sans", fontSize=7.5, leading=10.5, textColor=MUTED),
    "bullet": ParagraphStyle("Bullet", fontName="Sans", fontSize=9, leading=13, textColor=INK, leftIndent=11, firstLineIndent=-7, bulletIndent=2, spaceAfter=2.5),
    "toc": ParagraphStyle("Toc", fontName="Sans", fontSize=10, leading=15, textColor=INK, leftIndent=3, spaceAfter=2),
    "callout": ParagraphStyle("Callout", fontName="Sans", fontSize=8.7, leading=13, textColor=INK),
    "cover_title": ParagraphStyle("CoverTitle", fontName="Serif-Bold", fontSize=28, leading=33, textColor=WHITE),
    "cover_sub": ParagraphStyle("CoverSub", fontName="Sans", fontSize=12, leading=17, textColor=colors.HexColor("#D8DFEB")),
}


class ManualDoc(BaseDocTemplate):
    def __init__(self, filename: Path, title: str):
        super().__init__(
            str(filename), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
            topMargin=23 * mm, bottomMargin=18 * mm,
            title=title, author="Paixão Cortes Advogados",
            subject="Manual interno do Juris Control",
        )
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="main")
        self.addPageTemplates(PageTemplate(id="content", frames=[frame], onPage=self._header_footer))

    def _header_footer(self, canvas, doc):
        if doc.page == 1:
            canvas.saveState()
            canvas.setFillColor(NAVY)
            canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
            canvas.setFillColor(NAVY_2)
            canvas.rect(A4[0] - 42 * mm, 0, 42 * mm, A4[1], fill=1, stroke=0)
            canvas.setFillColor(GOLD)
            canvas.rect(A4[0] - 42 * mm, 0, 2 * mm, A4[1], fill=1, stroke=0)
            canvas.restoreState()
            return
        canvas.saveState()
        canvas.setFillColor(NAVY)
        canvas.rect(0, A4[1] - 14 * mm, A4[0], 14 * mm, fill=1, stroke=0)
        canvas.setFillColor(GOLD)
        canvas.circle(18 * mm, A4[1] - 7 * mm, 3.6 * mm, fill=1, stroke=0)
        canvas.setFillColor(NAVY)
        canvas.setFont("Serif-Bold", 8)
        canvas.drawCentredString(18 * mm, A4[1] - 8.2 * mm, "JC")
        canvas.setFillColor(WHITE)
        canvas.setFont("Sans-Bold", 8.5)
        canvas.drawString(25 * mm, A4[1] - 8.8 * mm, self.title)
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(0.8)
        canvas.line(0, A4[1] - 14 * mm, A4[0], A4[1] - 14 * mm)
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.4)
        canvas.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
        canvas.setFillColor(MUTED)
        canvas.setFont("Sans", 7)
        canvas.drawString(18 * mm, 9 * mm, "Paixão Cortes Advogados  •  Uso interno  •  v7.4.0")
        canvas.drawRightString(A4[0] - 18 * mm, 9 * mm, str(doc.page - 1))
        canvas.restoreState()


def cover(title: str, subtitle: str, topics: list[str]):
    items = []
    data = [[Paragraph("⚖", ParagraphStyle("mark", fontName="Serif-Bold", fontSize=26, alignment=TA_CENTER, textColor=NAVY))]]
    mark = Table(data, colWidths=[23 * mm], rowHeights=[23 * mm])
    mark.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    items += [Spacer(1, 20 * mm), mark, Spacer(1, 8 * mm)]
    items += [Paragraph("Juris Control", ParagraphStyle("brand", parent=S["cover_title"], fontSize=24, leading=28)),
              Paragraph("PAIXÃO CORTES ADVOGADOS", ParagraphStyle("brand2", parent=S["small"], fontSize=9, textColor=GOLD, spaceAfter=13 * mm)),
              Paragraph(title, S["cover_title"]), Spacer(1, 3 * mm), Paragraph(subtitle, S["cover_sub"]), Spacer(1, 12 * mm)]
    for t in topics:
        items.append(Paragraph(f"<font color='#D9A91C'>•</font>  {escape(t)}", ParagraphStyle("ct", parent=S["body"], textColor=WHITE, fontSize=9.5, leading=14)))
    items += [Spacer(1, 38 * mm), Paragraph("Versão do sistema 7.4.0  •  28 de setembro de 2026", ParagraphStyle("cv", parent=S["small"], textColor=colors.HexColor("#B9C2D3"))),
              Paragraph("Documento de circulação interna — Paixão Cortes Advogados", ParagraphStyle("cv2", parent=S["small"], textColor=colors.HexColor("#B9C2D3"))), PageBreak()]
    return items


def chapter(num: str, title: str, intro: str | None = None):
    blocks = [Spacer(1, 3 * mm), Paragraph(f"CAPÍTULO {num}", S["chapter"]), Paragraph(escape(title), S["h1"]),
              Table([[""]], colWidths=[42 * mm], rowHeights=[1.2 * mm], style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)])), Spacer(1, 5 * mm)]
    if intro:
        blocks.append(Paragraph(escape(intro), S["body"]))
    return blocks


def h2(text: str):
    return Paragraph(escape(text), S["h2"])


def h3(text: str):
    return Paragraph(escape(text), S["h3"])


def p(text: str):
    return Paragraph(escape(text), S["body"])


def bullets(items: list[str]):
    return [Paragraph(f"• {escape(item)}", S["bullet"]) for item in items]


def callout(label: str, text: str, tone="gold"):
    palette = {"gold": (GOLD_LIGHT, GOLD), "green": (colors.HexColor("#E4F4EC"), GREEN), "red": (colors.HexColor("#FBEAEA"), RED)}
    bg, border = palette[tone]
    box = Table([[Paragraph(f"<b>{escape(label)}:</b> {escape(text)}", S["callout"])]], colWidths=[165 * mm])
    box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), 0.7, border),
                              ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                              ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    return KeepTogether([Spacer(1, 3 * mm), box, Spacer(1, 3 * mm)])


def toc(title: str, entries: list[str]):
    out = [Spacer(1, 3 * mm), Paragraph("NAVEGAÇÃO", S["chapter"]), Paragraph("Sumário", S["h1"]),
           Table([[""]], colWidths=[42 * mm], rowHeights=[1.2 * mm], style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)])), Spacer(1, 5 * mm)]
    out.append(p(title))
    for i, entry in enumerate(entries, 1):
        out.append(Paragraph(f"<b>{i}.</b>  {escape(entry)}", S["toc"]))
    out.append(PageBreak())
    return out


def section(num: str, title: str, intro: str, subsections: list[tuple[str, list[str]]], notes: list[tuple[str, str, str]] | None = None):
    out = chapter(num, title, intro)
    for subtitle, items in subsections:
        out += [h2(subtitle)] + bullets(items)
    for note in notes or []:
        out.append(callout(*note))
    out.append(PageBreak())
    return out


def screenshot(name: str, caption: str):
    path = ROOT / "scripts" / "manual-painel-assets" / f"{name}.png"
    image = Image(str(path), width=145 * mm, height=90.625 * mm)
    caption_style = ParagraphStyle("Caption", parent=S["small"], alignment=TA_CENTER, spaceBefore=3, spaceAfter=5)
    return [image, Paragraph(escape(caption), caption_style)]


def illustrated_section(num: str, title: str, intro: str, image_name: str, caption: str,
                        subsections: list[tuple[str, list[str]]], notes: list[tuple[str, str, str]] | None = None):
    out = chapter(num, title, intro) + screenshot(image_name, caption)
    for subtitle, items in subsections:
        out += [h2(subtitle)] + bullets(items)
    for note in notes or []:
        out.append(callout(*note))
    out.append(PageBreak())
    return out


def build(filename: str, title: str, story):
    doc = ManualDoc(OUT / filename, title)
    doc.build(story)


def complete_manual():
    title = "Manual Completo do Juris Control"
    entries = [
        "Apresentação, acesso e navegação", "Painel de Controle", "Processos e Casos", "Monitoramento e Análise DJEN",
        "Clientes, documentos e etiquetas", "Workflow e auditoria", "Indicadores, ranking e inteligência jurídica",
        "Banco de Teses, Peças IA e repositório", "Distribuição TST e Benner", "Administração e ferramentas especializadas",
        "Fluxos integrados e boas práticas",
    ]
    st = cover(title, "Guia atualizado dos módulos operacionais e administrativos", ["Operação diária e prazos", "Processos, publicações e monitoramento", "TST, Benner, auditoria e inteligência jurídica"])
    st += toc("Este manual apresenta o sistema na versão 7.4.0. Recursos restritos aparecem identificados no texto.", entries)
    st += section("1", entries[0], "O Juris Control centraliza a rotina jurídica, os processos, publicações, prazos, audiências, documentos e controles especializados do escritório.", [
        ("Perfis e permissões", ["O menu e os dados exibidos dependem do perfil, das coordenações vinculadas e das permissões individuais.", "Administradores acessam configurações e ferramentas globais; coordenadores acompanham suas equipes; os demais perfis trabalham dentro do escopo autorizado.", "O perfil Advogado Temporário possui um menu reduzido para atividades de conferência."]),
        ("Estrutura da tela", ["A barra lateral reúne os módulos disponíveis; o cabeçalho mostra pesquisa, novidades, alertas e usuário.", "A pesquisa superior localiza processos, clientes, tarefas e outros registros acessíveis ao usuário.", "O número ao lado de alertas indica mensagens ou pendências ainda não lidas."]),
        ("Coordenações", ["As coordenações definem escopo de visibilidade, responsáveis, pessoas fixas, alertas e regras operacionais.", "Quando o usuário pertence a mais de uma coordenação, telas compatíveis permitem selecionar ou combinar o escopo."]),
    ], [("Segurança", "Nunca compartilhe credenciais. A visibilidade respeita perfil e coordenação; alterações relevantes permanecem na auditoria.", "gold")])
    st += section("2", entries[1], "O Painel de Controle é a agenda operacional do sistema e reúne tarefas, prazos, eventos, audiências, parcelamentos, alertas e workflows.", [
        ("Visões", ["Agenda: calendário mensal com lista do dia.", "Lista: consulta ordenável, inclusive por data limite, fatal e publicação.", "Kanban: distribuição por situação.", "Equipe: acompanhamento por responsável, com origem de publicação e workflow.", "Prazos, Audiências e Notificações: recortes especializados sem sair do Painel."]),
        ("Ações", ["Adicionar cria Tarefa, Evento, Prazo, Audiência, Parcelamento recorrente ou inicia Workflow.", "Tarefa, Prazo, Evento e Audiência abrem em painel lateral direito sobreposto, mantendo o Painel visível.", "Remanejar altera datas e responsáveis de vários itens; Pessoas em lote acrescenta responsáveis e envolvidos.", "Relatório e exportação de audiências respeitam período, coordenação e filtros aplicados."]),
    ], [("Manual detalhado", "Consulte também o Manual do Painel de Controle disponível na central Manual Sistema.", "green")])
    st += section("3", entries[2], "Processos e Casos concentra o cadastro, o histórico e o trabalho jurídico de cada processo ou atendimento consultivo.", [
        ("Cadastro e consulta", ["Novo Processo usa número CNJ; Novo Caso permite iniciar sem número e completar depois.", "A consulta Judit pode preencher tribunal, órgão, partes, assunto, valor, distribuição, relator, turma e movimentações quando disponíveis.", "Os dados digitados devem ser revisados antes de salvar; o número CNJ identifica o processo consultado."]),
        ("Ficha do processo", ["Visão Geral permite edição direta nos campos, sem botão Editar.", "Prazos, tarefas, eventos, audiências e parcelamentos ficam vinculados à ficha.", "Andamentos, publicações DJEN, redistribuições, documentos, pedidos, cobrança, partes, comentários e distribuições possuem áreas próprias.", "A aba Peças IA gera documentos com teses aplicáveis; a exportação em Word só ocorre após revisão humana."]),
        ("Ações vinculadas", ["Na ficha, Tarefa, Prazo, Evento e Audiência abrem em painel lateral direito sobreposto.", "Comentários aceitam menções e podem gerar notificações.", "A auditoria mostra quem alterou dados e quando."]),
    ])
    st += section("4", entries[3], "Monitoramento reúne movimentações e divergências; Análise DJEN transforma publicações encontradas em trabalho jurídico rastreável.", [
        ("Monitoramento", ["Acompanhe movimentações novas e divergências entre o formulário e dados externos.", "Acompanhamentos especiais podem ser cadastrados individualmente ou em lote e enriquecidos pela Judit.", "O botão Acatar aplica uma sugestão válida da Judit ao cadastro."]),
        ("Análise DJEN", ["Filtre por coordenação, captura, publicação, tribunal, tipo e situação; a busca aceita processo, termo e conteúdo.", "Revise o teor e as partes antes de classificar, descartar ou criar itens.", "O menu Adicionar cria tarefa, prazo, evento, audiência ou inicia workflow preservando a publicação como origem.", "Ações em massa permitem leitura, classificação, resumos com IA e exportações conforme o perfil."]),
        ("Termos DJEN", ["Cadastre termos, OABs e processos para monitoramento.", "Execuções e auditorias ajudam a conferir resultados, falhas e diferenças entre buscas.", "Comparar DJEN e ferramentas de servidor são restritas aos perfis autorizados."]),
    ], [("Regra de vínculo", "Workflow aberto a partir de publicação precisa de processo vinculado antes de iniciar.", "red")])
    st += section("5", entries[4], "Os cadastros complementares organizam relacionamentos, acervo e classificação dos registros.", [
        ("Clientes", ["Cadastre pessoas físicas e jurídicas e consulte os processos associados.", "O convite do Portal do Cliente permite acesso externo controlado aos próprios dados."]),
        ("Documentos", ["Envie, pesquise, classifique e exclua arquivos conforme sua permissão.", "Documentos de processo também aparecem na respectiva ficha e podem incluir anexos obtidos por integração."]),
        ("Etiquetas", ["Etiquetas organizam clientes, processos, itens e publicações.", "As cores facilitam identificação visual; etiquetas podem pertencer a uma coordenação."]),
    ])
    st += section("6", entries[5], "Workflows padronizam sequências de trabalho e a auditoria registra a trajetória das alterações.", [
        ("Workflow", ["Modelos definem etapas de tarefa, prazo, evento, audiência e parcelamento.", "Ao iniciar, selecione processo e coordenação quando exigidos; etapas materializadas aparecem no Painel com indicador de workflow.", "Etapas podem incluir datas, responsáveis, recorrência, alertas e atividades."]),
        ("Auditoria", ["O Relatório de Auditoria permite filtrar alterações de itens por período, usuário e coordenação.", "A ficha do processo guarda seu histórico; a Distribuição TST possui auditoria própria e auditoria de importações em lote.", "Registros mostram criação, alteração ou exclusão, valores anteriores e posteriores quando disponíveis."]),
    ])
    st += section("7", entries[6], "Os módulos analíticos transformam os registros operacionais em acompanhamento de desempenho e apoio à decisão.", [
        ("Indicadores", ["Use filtros de coordenação, usuário e período para consultar métricas e gráficos.", "O relatório de usabilidade pode ser exportado em Excel ou PDF mantendo os totais e gráficos da tela."]),
        ("Ranking Atendimento", ["Compara métricas de cumprimento e atendimento por responsável.", "Os detalhamentos permitem abrir os itens considerados em cada indicador."]),
        ("Inteligência Jurídica", ["Reúne resultados, ofensores e tendências, previsão de êxito e oportunidades de acordo.", "A análise Judit apresenta recortes de tempo, advogados, assuntos, varas/região e juízes.", "Estimativas dependem do histórico disponível e devem apoiar, não substituir, a avaliação jurídica."]),
    ])
    st += section("8", entries[7], "A inteligência artificial auxilia pesquisa e redação, sempre sujeita a conferência profissional.", [
        ("Banco de Teses", ["Cadastre e filtre teses por coordenação, tipo de peça, área e tags.", "A importação em lote de Word/PDF cria teses inicialmente inativas para curadoria."]),
        ("Peças IA", ["Na ficha do processo, escolha o tipo de peça e gere uma minuta com contexto do processo e teses aplicáveis.", "Edite e revise o conteúdo; a revisão humana é obrigatória antes da exportação em Word.", "O sistema registra quem revisou e quando."]),
        ("Repositório e Assistente", ["O Repositório IA permite consultar o acervo autorizado.", "O Assistente Jurídico analisa documentos e auxilia pesquisas conforme o acesso do usuário.", "Prompts administrativos configuram classificações específicas de publicações e TST."]),
    ], [("Responsabilidade", "Todo conteúdo produzido por IA deve ser conferido quanto a fatos, fundamentos, pedidos, prazos e citações.", "red")])
    st += section("9", entries[8], "A Distribuição TST organiza processos distribuídos, revisão jurídica, enriquecimento Judit e preparação da Carga Benner.", [
        ("Operação", ["Cards e filtros mostram a fazer, concluídos, pendências, matérias, duplicados, responsável, Benner e Judit.", "A edição é direta; seleções permitem marcar Pronto, Enviado, Em Análise, delegar, aplicar tags e preencher com Judit.", "Pendências vermelhas impedem conclusão operacional; avisos amarelos pedem conferência sem necessariamente rejeitar."]),
        ("Benner", ["A Carga Benner respeita seleção ou filtros e separa rejeições.", "Planilha de dossiês, relatório de partes e dossiês não localizados apoiam a conferência.", "Remessas Benner registra os arquivos enviados e seus estados."]),
    ], [("Manual detalhado", "Consulte também o Manual da Distribuição TST disponível na central Manual Sistema.", "green")])
    st += section("10", entries[9], "Ferramentas administrativas aparecem apenas aos perfis autorizados e devem ser usadas com conferência prévia.", [
        ("Administração", ["Gerencie usuários, perfis, permissões de menu e configurações.", "Consumo IA e Consumo Judit apresentam uso, custos e origem das consultas.", "Pool de proxies, DJEN Servidor, DJEN Local e análises de servidor apoiam a operação técnica do monitoramento."]),
        ("Admin. TST", ["Importe certidão PDF e planilha de distribuição; atualize dossiês, equipes, situação de envio e respostas Santander.", "Compare Certidão x Planilha sem gravar dados e exporte processos existentes apenas no PDF.", "Consulte auditorias, arquivados, Pautas TST, Classificação TST e ferramentas de conferência."]),
        ("Outras ferramentas", ["Reatribuir Processos transfere responsabilidades em lote.", "Valida Kurier compara acompanhamentos; Comparar DJEN e Compara Docs TST identificam divergências.", "Cofre de Senhas guarda credenciais criptografadas para integrações autorizadas."]),
    ])
    st += section("11", entries[10], "Os fluxos abaixo resumem a utilização recomendada dos principais recursos.", [
        ("Publicação até cumprimento", ["Capture e valide a publicação na Análise DJEN.", "Vincule o processo e crie o item ou inicie um workflow.", "Acompanhe no Painel, registre comentários e dê baixa com situação e data corretas.", "Consulte a ficha e a auditoria para reconstruir o histórico."]),
        ("Novo processo", ["Confirme o número CNJ, consulte a Judit, revise partes e dados e defina cliente, coordenação e responsáveis.", "Cadastre pedidos, documentos e etiquetas necessários.", "Ative monitoramentos aplicáveis e acompanhe movimentações e publicações."]),
        ("Boas práticas", ["Use filtros antes de ações em lote e confira a quantidade selecionada.", "Não repita importações ou consultas pagas sem necessidade.", "Revise relatórios e rejeições antes de enviar dados a sistemas externos.", "Mantenha datas em DD/MM/AAAA nas planilhas e confira o escopo da coordenação."]),
    ])
    build("Manual_Juris_Control_v7.4.0.pdf", title, st)


def painel_manual():
    title = "Manual do Painel de Controle"
    entries = ["Mapa da tela", "Escopo e cartões", "Agenda", "Lista e busca", "Kanban e Equipe", "Filtros completos", "Criar itens", "Preenchimento de Tarefa e Prazo", "Evento, Audiência e Parcelamento", "Workflow", "Edição, baixa e recorrência", "Comentários, atividades e cobranças", "Alertas", "Remanejar em lote", "Pessoas em lote", "Exportar atividades", "Relatório de audiências", "Exportar audiências", "Exemplos completos", "Dúvidas e boas práticas"]
    st = cover(title, "Guia operacional ilustrado e completo", ["20 capítulos com exemplos passo a passo", "10 capturas ilustrativas da interface", "Filtros, criações, baixas, lotes e relatórios"])
    st += toc("As imagens reproduzem fielmente a interface, com nomes e processos fictícios para não expor informações de clientes.", entries)
    st += illustrated_section("1", entries[0], "O Painel reúne toda a rotina jurídica em quatro faixas: comandos, totalizadores, visões/filtros e área de trabalho.", "overview", "Figura 1 — Visão geral ilustrativa do Painel de Controle.", [
        ("Faixa superior", ["O olho mostra ou oculta totalizadores; o ícone de ajustes mostra ou oculta a faixa de filtros.", "Rel. Audiências abre o relatório por usuário e situação; Exportar Audiências abre a exportação operacional.", "A faixa seguinte contém Pessoal/Escritório, situação, limpar, Exportar, Alertas, Remanejar, Pessoas em lote e Adicionar."]),
        ("Tipos e símbolos", ["Tarefa organiza trabalho; Evento registra compromisso; Prazo controla datas prevista e fatal; Audiência acrescenta dados processuais próprios; Parcelamento gera ocorrências.", "P indica origem em publicação; W indica workflow. Indicadores também mostram comentários, cobranças e atividades.", "Itens cumpridos ou concluídos permanecem legíveis; não use o aspecto visual como substituto da situação registrada."]),
    ], [("Privacidade", "Todas as imagens deste manual usam dados fictícios. A aparência pode variar conforme perfil, coordenação e tamanho da tela.", "gold")])
    st += section("2", entries[1], "Antes de interpretar números, confirme o escopo e os filtros ativos.", [
        ("Pessoal", ["Mostra sua rotina conforme responsabilidade, envolvimento, criação e demais filtros.", "Use para começar e encerrar o trabalho individual."]),
        ("Escritório", ["Mostra o escopo coletivo permitido. Administradores podem escolher uma coordenação ou Todas as coordenações.", "Coordenadores veem suas equipes; outros perfis permanecem limitados às autorizações recebidas."]),
        ("Totalizadores", ["O cartão da data abre as atividades do dia.", "Os cartões Tarefas, Eventos, Prazos, Audiências e Parcelamentos mostram contagens do recorte e funcionam como filtros rápidos.", "Um anel no cartão indica filtro ativo. Clique novamente ou use Limpar filtros para desfazer."]),
        ("Exemplo", ["Para conferir os cinco prazos exibidos no cartão vermelho: confirme Pessoal/Escritório, clique em Prazos e abra Lista para ler um por linha.", "Se o total parecer menor, verifique período, responsável, situação e origem antes de concluir que faltam registros."]),
    ])
    st += illustrated_section("3", entries[2], "Agenda é a visão mensal e a melhor opção para localizar concentração de compromissos por dia.", "overview", "Figura 2 — Calendário mensal, totalizadores e atalhos de tipo.", [
        ("Navegação", ["Use as setas do calendário para trocar o mês e Hoje para voltar ao mês atual.", "Clique em um dia para abrir o painel lateral com todas as atividades daquela data.", "Clique em um item curto do calendário para abrir diretamente seus detalhes."]),
        ("Criar nesta data", ["Abra o dia desejado e escolha Criar nesta data.", "Selecione Tarefa, Prazo, Evento ou Audiência; a data vem preenchida.", "Revise título, processo, coordenação, situação e pessoas antes de salvar."]),
        ("Exemplo", ["Para planejar 2 de outubro: clique no dia 02, confira os itens já existentes e use Criar nesta data > Prazo. Se houver data fatal diferente, informe-a separadamente."]),
    ])
    st += illustrated_section("4", entries[3], "Lista facilita conferência, ordenação e pesquisa de vários registros.", "list", "Figura 3 — Exemplo de lista filtrada por processo e tipo.", [
        ("Pesquisa", ["Digite número CNJ com ou sem máscara, título ou palavra. A busca pode localizar registros fora do mês mostrado.", "O X dentro do campo apaga apenas a busca; Limpar filtros restaura todo o conjunto.", "Pesquise pelo número completo quando existirem muitos resultados semelhantes."]),
        ("Filtros rápidos", ["Prazos, Audiências, Tarefas, Eventos e Parcelamentos deixam somente um tipo visível; Tudo remove esse recorte.", "Protocolados/Baixados aparece para perfis autorizados e abre uma lista própria com período e responsáveis.", "Cobranças alterna em três cliques: todos, somente minhas cobranças, somente cobranças da equipe, e volta a todos."]),
        ("Exemplo", ["Para localizar todas as atividades do processo 0001234-56.2026.5.01.0001: abra Lista, clique Tudo, cole o número no campo de busca e remova filtros de período se necessário."]),
    ])
    st += illustrated_section("5", entries[4], "Kanban e Equipe atendem à gestão visual do andamento e da carga de trabalho.", "kanban", "Figura 4 — Exemplo de Kanban por situação.", [
        ("Kanban", ["Agrupa itens por situação. Use para enxergar acúmulo em A concluir, Em andamento, Protocolado, Baixado e demais colunas configuradas.", "Os filtros, o escopo Pessoal/Escritório e a busca continuam valendo.", "Clique no cartão para abrir o detalhe; não arraste supondo alteração se a tela não apresentar esse comando."]),
        ("Equipe", ["Organiza os itens por responsável e facilita comparação de volume e pendências.", "A origem por publicação e workflow continua identificada.", "Use responsável + situação para analisar uma pessoa sem misturar itens concluídos."]),
        ("Exemplo", ["Para identificar sobrecarga: escolha Escritório, coordenação, Equipe, período da semana e A concluir. Compare quantidades e abra os itens antes de remanejar."]),
    ])
    st += illustrated_section("6", entries[5], "Filtros abre um painel lateral. As escolhas ficam em rascunho até clicar em Filtrar.", "filters", "Figura 5 — Painel de filtros com um exemplo de prazo fatal originado de publicação.", [
        ("Período", ["Informe Início e Fim. Com Data da publicação ativa, o período usa a publicação e exclui itens sem publicação.", "Em Prazo, escolha Data prevista, Data fatal ou ambas. Se somente Data fatal estiver ativa, prazos sem fatal ficam fora."]),
        ("Pessoas", ["Responsáveis aceita uma ou mais pessoas.", "Sou Responsável e Estou Envolvido podem ser usados isoladamente ou juntos; juntos, aceitam qualquer uma das duas relações."]),
        ("Status, classificação e situação", ["Status agrupa Todas, A concluir, Concluídas e Canceladas.", "Classificação permite selecionar vários tipos simultaneamente.", "Situação avançada combina valores detalhados como aguardando, protocolado ou baixado, conforme a configuração."]),
        ("Comentários, cobranças e origem", ["Comentários separa todos, com ou sem comentário.", "Cobranças separa todos, cobrados no dia ou não cobrados no dia.", "Origem separa itens vinculados a publicação dos demais."]),
        ("Exemplo", ["Para auditar prazos criados a partir de publicações de setembro: ative Data da publicação, informe 01/09/2026 a 30/09/2026, marque Prazo e Com publicação e clique Filtrar."]),
    ], [("Atenção", "Alterar opções e fechar o painel não aplica o rascunho. Use Filtrar; para zerar tudo, use Limpar filtros.", "gold")])
    st += illustrated_section("7", entries[6], "Adicionar oferece seis caminhos de criação.", "add", "Figura 6 — Menu Adicionar.", [
        ("Escolha correta", ["Tarefa: providência ou atividade sem natureza de prazo fatal.", "Evento: reunião, compromisso ou marco de agenda.", "Prazo: obrigação com controle de data prevista e fatal.", "Audiência: ato processual com horário, tipo e participantes.", "Parcelamento recorrente: acordo ou pagamento repetido.", "Workflow: sequência previamente configurada."]),
        ("Comportamento", ["Tarefa, Prazo, Evento e Audiência abrem em painel lateral direito sobreposto, mantendo o Painel visível.", "Parcelamento e Workflow usam formulários próprios.", "Pessoas fixas configuradas podem ser incluídas automaticamente."]),
    ])
    st += illustrated_section("8", entries[7], "Tarefa e Prazo compartilham dados de identificação, vínculo, pessoas e acompanhamento, mas Prazo possui controle temporal adicional.", "drawer", "Figura 7 — Exemplo fictício de um novo Prazo no painel lateral.", [
        ("Passo a passo — Tarefa", ["Clique Adicionar > Tarefa.", "Escreva um título objetivo começando por verbo: Revisar contestação, Solicitar documento, Conferir cálculo.", "Vincule processo e coordenação; escolha situação, responsável e envolvidos.", "Informe data de vencimento, descrição, prioridade e recorrência quando aplicável; salve."]),
        ("Passo a passo — Prazo", ["Clique Adicionar > Prazo e vincule o processo correto.", "Informe Data prevista para organização interna e Data fatal para o limite jurídico.", "Defina responsável principal, envolvidos, situação, origem e observações.", "Revise o CNJ e as datas antes de salvar."]),
        ("Exemplo", ["Publicação em 28/09 determinou Recurso Ordinário. Cadastre título Apresentar Recurso Ordinário; processo 0001234-56.2026.5.01.0001; prevista 30/09; fatal 02/10; responsável Ana Exemplo.", "Não use a data interna como substituta automática da fatal: cada campo cumpre finalidade diferente."]),
    ], [("Vínculo", "Se o item nasceu de uma publicação, prefira criá-lo na Análise DJEN para preservar a origem e a rastreabilidade.", "red")])
    st += section("9", entries[8], "Os outros três tipos atendem a compromissos e lançamentos com estruturas próprias.", [
        ("Evento", ["Informe título, início e fim, local ou link, processo, coordenação e participantes.", "Ao remanejar, a opção Mover o fim junto com o início mantém a duração.", "Exemplo: Reunião com cliente em 06/10, 10h às 11h, vinculada ao processo."]),
        ("Audiência", ["Informe data, hora, tipo, modalidade/local, processo, responsável, preposto, testemunha e observações disponíveis.", "Use os dados processuais corretos porque eles alimentam relatório e planilha de audiências.", "Exemplo: Audiência de instrução em 08/10 às 14h30, modalidade telepresencial, com advogado e preposto definidos."]),
        ("Parcelamento recorrente", ["Informe título, valor quando disponível, primeira data, quantidade/periodicidade e responsáveis.", "A baixa de uma ocorrência não deve concluir automaticamente a série.", "Exemplo: 12 parcelas mensais com vencimento todo dia 10; cada ocorrência deve registrar sua própria baixa."]),
    ])
    st += section("10", entries[9], "Workflow executa um modelo de etapas já configurado e reduz cadastros repetitivos.", [
        ("Como iniciar", ["Clique Adicionar > Workflow; escolha o modelo.", "Vincule processo e coordenação quando exigidos e confira as etapas previstas.", "Defina dados iniciais e confirme. As etapas materializadas aparecem no Painel com W."]),
        ("A partir de publicação", ["Abra o workflow pela publicação para manter a origem.", "O sistema deve recusar a inicialização se não houver processo vinculado.", "Corrija ou cadastre o processo e reinicie; não recrie etapas manualmente para contornar a trava."]),
        ("Exemplo", ["No workflow Acórdão — EDS, a publicação inicia a sequência de análise, prazo e protocolo. Confira processo, datas e responsáveis antes de confirmar."]),
    ])
    st += section("11", entries[10], "Clique no item para abrir seus detalhes. Edição e baixa respeitam tipo, situação e permissão.", [
        ("Edição", ["Altere os campos permitidos e salve. A auditoria registra mudanças relevantes.", "Use reagendamento quando a data efetivamente mudou; registre o motivo em comentário.", "Em recorrências, confirme se a alteração vale para uma ocorrência ou para a série."]),
        ("Baixa rápida", ["Escolha a situação final, informe a data real de cumprimento e comentário quando exigido.", "Para recorrentes, selecione somente esta ocorrência ou toda a série.", "Cancelar e ocultar preserva o registro, mas o remove da agenda operacional."]),
        ("Exemplo", ["Uma parcela de setembro foi paga: abra somente a ocorrência de setembro, registre a data do pagamento e conclua essa ocorrência; não encerre as parcelas futuras."]),
    ], [("Regra visual", "Cumpridos e concluídos permanecem sem tachado. Protocolado e baixado podem usar risco visual conforme a situação.", "gold")])
    st += section("12", entries[11], "O detalhe do item concentra comunicação e atividades menores vinculadas.", [
        ("Comentários", ["Registre decisões e fatos úteis ao histórico.", "Use @nome para mencionar colegas; a menção gera notificação conforme as configurações.", "Comentários ainda não vistos recebem destaque."]),
        ("Atividades", ["Atividades internas podem ter data e responsável próprios.", "Elas aparecem na data correta mesmo quando o item-pai já foi concluído.", "Concluir uma atividade não conclui automaticamente todo o item."]),
        ("Cobranças", ["Marcar como cobrado registra o acompanhamento do dia sem dar baixa.", "O botão Cobranças alterna entre todas, minhas e equipe.", "Use para controlar follow-up, não para substituir comentário ou situação."]),
        ("Exemplo", ["Após cobrar documento do cliente, marque a cobrança e escreva: Contato realizado em 28/09; retorno prometido para 30/09. Não conclua a tarefa enquanto o documento não chegar."]),
    ])
    st += illustrated_section("13", entries[12], "Alertas mantém o menu do Painel e reúne avisos ainda não lidos e já consultados.", "alerts", "Figura 8 — Exemplo de Central de notificações.", [
        ("Leitura", ["O número no botão indica notificações não lidas.", "Clique no alerta para abrir o item relacionado.", "Alertas podem informar prazo próximo, audiência, menção, mudança e outras ocorrências configuradas."]),
        ("Tratamento", ["Leia o alerta, abra o item e confirme processo, data e responsável.", "Tome a providência no item; marcar como lido não equivale a cumprir a obrigação.", "Se o aviso não for aplicável, registre a justificativa antes de encerrá-lo quando a tela permitir."]),
    ])
    st += illustrated_section("14", entries[13], "Remanejar altera datas e responsáveis de vários itens com prévia obrigatória.", "remanejar", "Figura 9 — Exemplo de remanejamento com datas antigas e novas.", [
        ("Passo a passo", ["Abra Remanejar e escolha o tipo: tarefa, prazo, evento ou audiência.", "Informe período, coordenação, responsável atual, situações e busca; clique Buscar.", "Selecione os itens e defina, por campo, manter, definir nova data ou deslocar por dias úteis/conforme opções exibidas.", "Em responsáveis, escolha Manter, Trocar por ou Acrescentar.", "Clique Revisar alteração, confira antigas e novas datas e confirme."]),
        ("Eventos e erros", ["Em eventos, Mover o fim junto com o início preserva a duração.", "Itens com data inválida ficam sinalizados e bloqueiam a confirmação.", "O andamento aparece durante a aplicação; aguarde o resultado."]),
        ("Exemplo", ["Para mover prazos internos dois dias úteis: filtre o período e a coordenação, selecione somente os itens autorizados, aplique +2 dias à prevista e revise se a fatal deve permanecer."]),
    ], [("Cuidado", "Não mova a data fatal por conveniência interna. Altere-a apenas quando houver fundamento e autorização.", "red")])
    st += illustrated_section("15", entries[14], "Pessoas em lote acrescenta responsáveis ou envolvidos; nunca remove os existentes.", "people", "Figura 10 — Passo 1 de Pessoas em lote.", [
        ("Permissão", ["A ação é exibida para administradores e coordenadores.", "Os resultados respeitam coordenações permitidas."]),
        ("Três passos", ["1. Informe período, tipos, coordenação, pessoa atual, situações e busca; clique Listar itens.", "2. Selecione itens e, opcionalmente, atividades internas específicas.", "3. Escolha novos responsáveis e/ou envolvidos, revise e aplique."]),
        ("Exemplo", ["Para incluir uma advogada de apoio em audiências de outubro: filtre Audiências + coordenação + período, confira cada resultado, selecione e acrescente-a como envolvida.", "Se uma pessoa deve ser substituída, use a edição individual ou Remanejar quando houver a opção Trocar por."]),
    ])
    st += section("16", entries[15], "Exportar gera uma planilha de atividades para conferência ou trabalho externo.", [
        ("Passo a passo", ["Clique Exportar.", "Informe Data inicial e Data final; campos vazios incluem todas as datas.", "Marque Tarefas, Eventos, Prazos, Audiências e/ou Parcelamentos. Tipos vazios significam Todos.", "Clique Exportar e aguarde o download."]),
        ("Escopo", ["A exportação obedece ao acesso do usuário e aos filtros aplicáveis do Painel.", "Antes de compartilhar, confira se a planilha contém somente a coordenação e o período desejados."]),
        ("Exemplo", ["Para uma agenda semanal, informe 28/09/2026 a 02/10/2026 e selecione Prazos + Audiências. Abra o Excel e confira o total antes de encaminhar."]),
    ])
    st += section("17", entries[16], "Rel. Audiências apresenta uma visão analítica por usuário e situação.", [
        ("Uso", ["Clique Rel. Audiências.", "Ajuste De e Até; o período inicialmente sugerido pode ser alterado depois de abrir.", "Escolha Usar período ou Usar mês/ano quando a tela oferecer essa alternância.", "Confira totais e detalhamentos e exporte o Excel se necessário."]),
        ("Diferença", ["Rel. Audiências é analítico e resume distribuição por pessoa/situação.", "Exportar Audiências gera a planilha operacional no formato padronizado."]),
    ])
    st += illustrated_section("18", entries[17], "A exportação operacional exige conferência da quantidade antes de liberar o arquivo.", "export", "Figura 11 — Exemplo de contagem prévia antes da exportação.", [
        ("Passo a passo", ["Clique no botão verde Exportar Audiências.", "Escolha De, Até e uma coordenação disponível, ou Todas as minhas coordenações.", "Clique Verificar audiências encontradas.", "Leia a quantidade exibida. O botão Exportar planilha fica disponível somente quando o total é maior que zero.", "Clique Exportar planilha (N audiências)."]),
        ("Validações", ["A data inicial não pode ficar depois da final.", "Alterar período ou coordenação apaga a contagem e exige nova verificação.", "Nenhuma audiência encontrada mantém a exportação bloqueada."]),
        ("Colunas", ["DATA, HORA, NÚMERO PROCESSO, COMARCA, UF, PÓLO ATIVO, CLIENTE, TERCEIRIZADO, TIPO DE AUDIÊNCIA, RESUMO DO OBJETO, PREPOSTO, TESTEMUNHA, ADVOGADO/CORRESPONDENTE, OBS e STATUS FINAL."]),
    ])
    st += section("19", entries[18], "Os exemplos abaixo combinam recursos em situações frequentes.", [
        ("Encontrar prazo de uma publicação", ["Abra Lista; em Filtros, ative Data da publicação e informe o período.", "Marque Prazo e Com publicação; cole o CNJ na busca.", "Abra o resultado e confirme o vínculo da publicação e as datas prevista/fatal.", "Se não aparecer, limpe filtros e pesquise novamente antes de reportar ausência."]),
        ("Preparar agenda de audiência", ["Escolha Escritório e a coordenação.", "Filtre Audiências no período desejado e revise responsáveis.", "Use Exportar Audiências, confira o total e gere a planilha.", "Verifique campos vazios de preposto, testemunha ou advogado antes de compartilhar."]),
        ("Redistribuir trabalho da equipe", ["Abra Equipe com status A concluir e período da semana.", "Identifique concentração por responsável.", "Abra Remanejar, repita filtros, selecione itens, escolha Trocar por ou Acrescentar e revise a prévia."]),
        ("Registrar cumprimento", ["Abra o item, use baixa rápida e informe situação e data real.", "Adicione comentário com resultado ou protocolo.", "Se recorrente, selecione somente a ocorrência correta."]),
    ])
    st += section("20", entries[19], "Use esta lista para prevenir os erros mais comuns.", [
        ("Quando um item não aparece", ["Confira Pessoal/Escritório, coordenação, período, situação, tipo, responsáveis, origem e busca.", "Use Limpar filtros e pesquise pelo CNJ completo.", "Confirme se o item foi cancelado/ocultado ou concluído fora do grupo atual."]),
        ("Quando a contagem diverge", ["Cartões refletem o recorte atual; compare os mesmos filtros.", "Data da publicação exclui itens sem publicação.", "Data fatal exclui prazos sem fatal quando usada isoladamente."]),
        ("Boas práticas", ["Use títulos objetivos e vincule o processo correto.", "Registre data real na baixa e explique reagendamentos.", "Não conclua toda uma série quando somente uma ocorrência terminou.", "Revise quantidades e amostras antes de ações em lote ou exportações.", "Use menções somente para pessoas que precisam agir ou tomar ciência."]),
        ("Suporte", ["Ao relatar problema, informe tela, escopo, coordenação, filtros, CNJ e ação realizada.", "Não envie senha nem dados sigilosos em capturas. Oculte nomes e documentos quando compartilhar fora do escritório."]),
    ])
    build("Manual_Painel_de_Controle.pdf", title, st)


def tst_manual():
    title = "Manual da Distribuição TST"
    entries = ["Visão geral e acesso", "Cards e responsáveis", "Filtros e seleção", "Ficha e edição", "Pendências e matérias", "Judit", "Ações em lote e delegação", "Relatórios e Carga Benner", "Admin. TST", "Duplicados, arquivamento e auditoria", "Roteiro e boas práticas"]
    st = cover(title, "Operação, conferência, importações e Carga Benner", ["Distribuições e responsáveis", "Matérias, pendências e Judit", "Admin. TST, relatórios e auditoria"])
    st += toc("Guia exclusivo da Distribuição TST e das ferramentas administrativas relacionadas.", entries)
    st += section("1", entries[0], "A Distribuição TST centraliza os processos distribuídos no Tribunal Superior do Trabalho e a preparação das informações que seguem para o Benner.", [
        ("Acesso", ["O módulo é exibido apenas às coordenações autorizadas e ao administrador.", "Ações administrativas, arquivamento, auditorias e algumas importações exigem perfil específico."]),
        ("Registro", ["Cada linha representa uma distribuição vinculada a processo e dossiê.", "A lista combina dados processuais, partes, turma, relator, recurso, matérias, chance, responsáveis, Judit e situação de envio.", "A data de distribuição é a referência padrão dos relatórios e cargas."]),
    ])
    st += section("2", entries[1], "Os cartões respeitam os filtros e podem ser combinados para criar recortes operacionais.", [
        ("Cartões gerais", ["A fazer mostra registros ainda não concluídos; Concluídos reúne pronto, planilhado e enviado.", "Pronto sem pendência separa os registros aptos; Pronto com pendência destaca inconsistências.", "Duplicados, revisar matérias e somente Outra Matéria possuem cartões próprios quando aplicáveis."]),
        ("Responsáveis", ["O cartão pessoal compara atribuídos e prontos.", "Para administradores, cada responsável mostra Total, Pronto, Sem pendência, Com pendência, Sem matéria do dossiê, Outra Matéria e Faltam.", "Clique no nome ou no número desejado para aplicar o filtro correspondente."]),
        ("Combinação", ["Mais de um cartão pode permanecer ativo.", "Use Limpar Filtros antes de iniciar outro recorte.", "Ocultar cards reduz a área ocupada sem alterar os dados."]),
    ])
    st += section("3", entries[2], "Os filtros determinam a lista, os relatórios e, quando não há seleção manual, várias ações em lote.", [
        ("Busca e período", ["Busque por processo, dossiê e parte recorrente.", "Use data inicial e final para limitar a distribuição.", "Filtre a posição da Parte Recorrente, inclusive combinações com terceiro."]),
        ("Categorias", ["Benner, Judit, TAGs e filtro inverso, Em análise, Provas Digitais, Status de envio, Equipe e Aba de origem.", "Dossiê preenchido/válido, Processo válido, Duplicados, Origem de importação, Matérias por dossiê, Situação do processo e Subida em massa.", "A origem diferencia Resposta Santander, Certidão TST e Planilha Distribuição."]),
        ("Seleção", ["Informe uma quantidade entre 1 e o total filtrado e clique Selecionar.", "A seleção segue a ordem atual da lista.", "Quando houver registros selecionados, ações e relatórios usam somente eles; limpe a seleção para voltar ao filtro completo."]),
    ], [("Conferência", "Antes de qualquer ação em lote, confira filtros, total encontrado e quantidade selecionada.", "gold")])
    st += section("4", entries[3], "A edição é direta: clique nos campos editáveis ou no processo para abrir a ficha completa.", [
        ("Lista", ["A linha dupla mostra os principais dados e etiquetas de situação.", "Alterações diretas são salvas sem botão Editar.", "Processos duplicados recebem destaque vermelho; clique para comparar os registros laterais."]),
        ("Ficha", ["A aba Distribuição reúne processo, dossiê, data, equipe, partes, turma, relator e dados do recurso.", "Matérias e análise organizam recurso do banco, reclamante e terceiro.", "Pendências e avisos aparecem na lateral para orientar a revisão.", "O histórico permite consultar alterações anteriores do registro."]),
        ("Conclusão", ["Marcar Pronto indica que a revisão terminou e o registro está preparado para a carga.", "Marcar Enviado registra que a etapa de transmissão foi concluída.", "Em Análise trava o conjunto em revisão; Finalizar Análise remove essa marca."]),
    ])
    st += section("5", entries[4], "Pendências e matérias devem refletir os mesmos critérios usados pela Carga Benner.", [
        ("Pendências", ["Verificar Pendências mostra na lista os campos obrigatórios ainda ausentes.", "Relatório Pendências gera Excel do recorte ou da seleção.", "Tipo de recurso fora da lista e dossiê inválido aparecem como pendência e também rejeitam na carga."]),
        ("Matérias", ["As matérias cadastradas para o dossiê aparecem destacadas e orientam a análise.", "Matérias removidas não podem permanecer como aviso, pendência ou exportação órfã.", "Outra Matéria é neutra: não gera pendência nem rejeição e segue literalmente para a Carga Benner.", "Somente Outra Matéria gera aviso de conferência, não erro."]),
        ("Recurso de terceiro", ["Somente Tipo de Recurso é obrigatório.", "A Carga Benner exporta apenas esse dado para o recurso de terceiro."]),
    ])
    st += section("6", entries[5], "A Judit enriquece os registros com dados processuais oficiais disponíveis.", [
        ("Uso individual e em lote", ["Use o comando Judit no registro ou Preencher com Judit para a seleção/filtro.", "Acompanhe o progresso e use Cancelar se precisar interromper o lote.", "Consultas bem-sucedidas do mesmo processo no mesmo dia podem reutilizar o cache."]),
        ("Dados", ["A consulta pode atualizar partes, turma, relator, movimentações e metadados.", "Tipo de recurso só é aceito quando existe evidência processual; o sistema não deve atribuir o recurso ao banco por suposição.", "Problema Judit sinaliza erro ou ausência de dados para nova conferência."]),
        ("Documentos", ["Documentos e análises relacionados ficam disponíveis nos módulos próprios.", "Evite consultas repetidas sem necessidade, pois podem gerar custo."]),
    ])
    st += section("7", entries[6], "Selecione os registros e use a ação apropriada. Administradores e coordenadores possuem comandos adicionais.", [
        ("Situações", ["Marcar como Pronto, Enviado, Em Análise ou Finalizar Análise.", "Marcar/Desmarcar Subida em Massa identifica lotes específicos."]),
        ("Delegação", ["Delegar atribui responsáveis aos registros selecionados.", "Distribuir automaticamente usa o conjunto filtrado ou, para administrador, os selecionados.", "Kanban Delegação organiza o acompanhamento por situação e responsável."]),
        ("TAGs e Judit", ["Aplicar TAG em lote exige perfil autorizado e respeita a seleção/filtros.", "Preencher com Judit processa o conjunto e mostra andamento."]),
    ])
    st += section("8", entries[7], "Os relatórios usam os registros selecionados; sem seleção, usam os filtros ativos.", [
        ("Acesso Rápido", ["Nova Distribuição abre a ficha em branco.", "Total por Situação exibe um resumo do recorte.", "Dados Benner e Kanban Delegação abrem os módulos relacionados.", "Manual de Instruções baixa este manual atualizado."]),
        ("Relatórios", ["Relatório Excel exporta os dados da Distribuição.", "Relatório PDF Partes lista polos processuais.", "Dossiês não localizados e Planilha Dossiês apoiam a correção no Benner.", "Relatório Pendências lista campos obrigatórios em aberto."]),
        ("Carga Benner", ["Gerar Carga Benner prepara o arquivo no leiaute oficial.", "Os registros devem estar prontos e sem pendências impeditivas.", "Dossiês inválidos, tipo de recurso fora da lista e outros impedimentos são separados em Rejeições da Carga.", "Confira a planilha e as rejeições antes da transmissão."]),
    ])
    st += section("9", entries[8], "Admin. TST reúne operações de importação e manutenção que não devem ficar na tela operacional.", [
        ("Importações", ["Importar PDF Certidão cadastra distribuições e atualiza a data quando o processo já existe.", "Comparar Certidão x Planilha lista processos presentes no PDF e ausentes na planilha sem gravar dados.", "Importar Planilha Distribuição lê todas as abas e preserva a aba de origem.", "Atualizar Dossiês usa o CNJ; Atualizar Equipe usa o dossiê; Atualizar Situação de Envio aplica os códigos configurados.", "Resposta Santander atualiza distribuição, partes e dossiê; Benner SIM faz a conferência em massa.", "Pedidos por Dossiê importa as matérias usadas no destaque e na validação."]),
        ("Conferências", ["Verificar Outro Escritório marca processos de migração.", "Base PCA localiza processo/dossiê e aplica TAG sem criar nova duplicidade.", "Ajustar Chance Turma/Relator produz relatório das inversões realizadas.", "Classificação TST e Pautas TST possuem telas próprias."]),
        ("Planilhas e documentos", ["Planilha TST processa e exporta resultados; Corrigir Planilha higieniza o arquivo.", "Analisar Prazos extrai prazos de documentos Word.", "Busca Publicação, Errata DJEN e ferramentas relacionadas apoiam conferências específicas."]),
    ])
    st += section("10", entries[9], "Registros não são apagados como primeira opção: o sistema preserva histórico por arquivamento.", [
        ("Duplicados", ["O card e o filtro Duplicados exibem o grupo completo por número normalizado.", "Arquivar duplicados mantém o registro com mais TAGs; em empate, considera preenchimento e atualização.", "A Base PCA está protegida contra novas duplicidades, mas duplicados antigos devem ser conferidos."]),
        ("Arquivamento", ["Usuários autorizados podem arquivar selecionados.", "Arquivados deixam a lista operacional e permanecem disponíveis em tela própria.", "Restauração é exclusiva de administrador."]),
        ("Auditoria", ["Auditoria da Distribuição mostra criação, alteração e exclusão, usuário, data e valores.", "Auditoria de Importações em Lote registra tipo de operação, arquivo e processos afetados.", "Use o histórico da ficha para conferir um registro específico."]),
    ])
    st += section("11", entries[10], "A sequência abaixo reduz retrabalho e evita envio de dados incompletos.", [
        ("Recebimento", ["Importe a Certidão ou a planilha pela ferramenta correta.", "Confira a quantidade, rejeições e origem da importação.", "Filtre o novo lote por data, aba ou origem."]),
        ("Análise", ["Distribua responsáveis e marque Em Análise.", "Preencha com Judit quando necessário.", "Revise processo, dossiê, parte recorrente, recurso, matérias, turma, relator e chance.", "Verifique pendências; somente então marque Pronto."]),
        ("Envio", ["Filtre Pronto sem pendência ou selecione o conjunto validado.", "Gere a Carga Benner e examine Rejeições.", "Transmita o arquivo e marque o lote como planilhado/enviado conforme o fluxo.", "Mantenha relatórios e auditoria para conferência posterior."]),
        ("Boas práticas", ["Datas de planilha devem usar DD/MM/AAAA.", "Dossiês com barra são aceitos; não normalize manualmente.", "Não remova matérias oficiais sem revisar impactos.", "Use arquivamento, não exclusão, para manter rastreabilidade."]),
    ])
    build("Manual_Distribuicao_TST.pdf", title, st)


if __name__ == "__main__":
    complete_manual()
    painel_manual()
    tst_manual()
    for path in sorted(OUT.glob("Manual_*")):
        if path.suffix.lower() == ".pdf":
            print(path.name, path.stat().st_size)