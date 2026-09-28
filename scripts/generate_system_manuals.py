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
    out = chapter("", "Sumário")
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
    entries = ["Visão geral", "Escopo Pessoal e Escritório", "Cards e busca", "Filtros", "Visões", "Criação de itens", "Edição, baixa e recorrência", "Ações em lote", "Relatórios e exportações", "Roteiro e boas práticas"]
    st = cover(title, "Agenda operacional, filtros, ações e relatórios", ["Tarefas, prazos, eventos e audiências", "Agenda, lista, kanban e equipe", "Baixas, remanejamento e exportações"])
    st += toc("Guia exclusivo da rotina diária no Painel de Controle.", entries)
    st += section("1", entries[0], "O Painel de Controle reúne os compromissos jurídicos em uma única área. Alterar a visão não muda os dados; apenas muda a forma de consultá-los.", [
        ("Tipos de item", ["Tarefa: atividade sem necessariamente possuir prazo fatal.", "Prazo: obrigação com data prevista e, quando aplicável, data fatal.", "Evento: compromisso de agenda.", "Audiência: compromisso processual com informações específicas.", "Parcelamento recorrente: série de parcelas e pagamentos."]),
        ("Indicadores", ["P indica origem em publicação; W indica item gerado por workflow.", "Comentários não vistos, cobranças e atividades aparecem com indicadores próprios.", "Itens concluídos permanecem legíveis e não são tachados; risco visual é reservado às situações aplicáveis."]),
    ])
    st += section("2", entries[1], "O seletor no topo define se o usuário vê sua própria rotina ou o escopo autorizado do escritório.", [
        ("Pessoal", ["Prioriza itens em que você é responsável, envolvido ou criador, conforme os filtros.", "É o recorte recomendado para a execução diária individual."]),
        ("Escritório", ["Mostra o escopo das coordenações e pessoas autorizadas.", "Administradores podem selecionar uma coordenação específica ou todas.", "Os dados continuam limitados pelas regras de acesso do usuário."]),
    ])
    st += section("3", entries[2], "Os cartões resumem o recorte atual e também funcionam como filtros rápidos.", [
        ("Cartões", ["O cartão da data abre os itens do dia.", "Tarefas, eventos, prazos, audiências e parcelamentos mostram quantidades do recorte atual.", "Clique em um cartão para focar naquele tipo; clique novamente ou limpe os filtros para voltar."]),
        ("Busca", ["A busca aceita número do processo com ou sem máscara, cliente, partes, título e outros textos acessíveis.", "A busca global pode localizar itens fora do mês exibido e abrir diretamente o detalhe.", "Use Limpar filtros antes de concluir que um item não existe."]),
    ])
    st += section("4", entries[3], "O botão Filtros abre um painel lateral. As escolhas só passam a valer ao clicar em Filtrar.", [
        ("Período e datas", ["Defina início e fim; o período pode usar data prevista/fatal ou data da publicação.", "Quando Data da publicação está ativa, itens sem publicação ficam fora.", "Em Prazo, escolha Data prevista, Data fatal ou ambas."]),
        ("Pessoas e situação", ["Filtre por responsáveis; use Sou Responsável e Estou Envolvido para um recorte pessoal.", "Status agrupa Todas, A concluir, Concluídas e Canceladas.", "Situação avançada permite combinar situações detalhadas configuradas no sistema."]),
        ("Conteúdo", ["Classificação filtra tarefas, eventos, prazos, audiências e parcelamentos.", "Comentários separa itens com ou sem comentário.", "Cobranças separa já cobrados ou ainda não cobrados no dia.", "Origem separa itens criados de publicações dos demais."]),
    ], [("Aplicação", "Se alterar datas ou opções no painel, clique em Filtrar. Limpar filtros restaura o padrão.", "gold")])
    st += section("5", entries[4], "Escolha a visão adequada à atividade que deseja executar.", [
        ("Agenda", ["Mostra o calendário mensal e os itens em cada dia.", "Clique no dia para abrir a lista lateral; use Criar nesta data para pré-preencher um novo item.", "Atividades internas aparecem na data própria, independentemente da conclusão do item-pai."]),
        ("Lista", ["Ideal para leitura sequencial e comparação.", "A ordenação por data pode usar limite, fatal ou publicação.", "Clique na linha para abrir o item e seus detalhes."]),
        ("Kanban e Equipe", ["Kanban agrupa itens por situação para acompanhamento visual.", "Equipe organiza por responsável e facilita a gestão coletiva.", "Os filtros do Painel continuam valendo nas duas visões."]),
        ("Prazos, Audiências e Notificações", ["Prazos apresenta o recorte específico de datas fatais.", "Audiências reúne os compromissos e suas informações próprias.", "Notificações mantém o menu e permite abrir o item apontado no alerta."]),
    ])
    st += section("6", entries[5], "O botão Adicionar cria itens sem sair da agenda.", [
        ("Tarefa, Prazo, Evento e Audiência", ["Cada opção abre um painel lateral direito sobreposto, mantendo o conteúdo do Painel visível ao fundo.", "Preencha título, processo, coordenação, data, situação, responsável e envolvidos conforme o tipo.", "Pessoas fixas configuradas para o tipo podem aparecer automaticamente e não devem ser removidas."]),
        ("Parcelamento e Workflow", ["Parcelamento recorrente gera parcelas mensais vinculadas ao evento-pai.", "Workflow inicia uma sequência padronizada de etapas; admin pode escolher coordenação e usuários comuns seguem seu escopo.", "Workflow vindo de publicação exige processo vinculado."]),
        ("Criar nesta data", ["No painel do dia, selecione Tarefa, Prazo, Evento ou Audiência.", "A data clicada já vem preenchida; revise os demais campos antes de salvar."]),
    ])
    st += section("7", entries[6], "Clique em qualquer item para abrir o detalhe. As opções disponíveis dependem do tipo e da permissão.", [
        ("Edição", ["Altere campos diretamente e salve; comentários e atividades permanecem vinculados.", "Reagendamento permite informar nova data para prazos e audiências.", "Itens recorrentes distinguem esta ocorrência da série completa."]),
        ("Baixa", ["A baixa rápida solicita situação, data de cumprimento e comentário quando exigido.", "Em recorrências, escolha somente esta ocorrência ou toda a série.", "Cancelar e ocultar preserva o registro, mas remove o item da agenda operacional."]),
        ("Comentários e cobranças", ["Menções com @ notificam colegas.", "Comentários não vistos recebem destaque.", "A marca de cobrança registra o acompanhamento sem concluir o item."]),
    ])
    st += section("8", entries[7], "As ações em lote alteram vários itens. Sempre filtre, confira a quantidade e revise a prévia.", [
        ("Remanejar", ["Escolha o tipo, período, coordenação, pessoas e situações.", "Selecione os resultados e defina novas datas ou responsáveis.", "Revise a alteração antes de aplicar; itens com erro ficam identificados."]),
        ("Pessoas em lote", ["Disponível a administradores e coordenadores.", "Localize os itens, selecione e acrescente responsáveis ou envolvidos.", "A ação acrescenta pessoas sem remover as já vinculadas."]),
        ("Exportar atividades", ["Informe período e os tipos desejados.", "A planilha respeita o escopo e os filtros do Painel."]),
    ], [("Cuidado", "Ações em lote podem alcançar muitos registros. Use filtros específicos e confira o total antes de confirmar.", "red")])
    st += section("9", entries[8], "O Painel possui relatório analítico e exportação operacional de audiências.", [
        ("Relatório de Audiências", ["Abra Rel. Audiências e ajuste De/Até, mesmo quando o período veio preenchido pelo Painel.", "O relatório resume audiências por usuário e situação.", "A exportação em Excel acompanha o período escolhido."]),
        ("Exportar Audiências", ["Clique no botão verde Exportar Audiências.", "No painel lateral, escolha De, Até e uma das suas coordenações, ou todas.", "Clique em Verificar audiências encontradas; o sistema informa a quantidade.", "O botão Exportar planilha só libera após a conferência e mostra o total que será exportado.", "Se alterar data ou coordenação, faça uma nova verificação."]),
        ("Formato da planilha", ["A planilha traz data, hora, processo, comarca, UF, polo ativo, cliente, terceirizado, tipo, resumo, preposto, testemunha, advogado/correspondente, observação e status final.", "As linhas são ordenadas por data e hora e obedecem aos demais filtros aplicados."]),
    ])
    st += section("10", entries[9], "Uma rotina consistente reduz atrasos e mantém a auditoria confiável.", [
        ("Início do trabalho", ["Confirme Pessoal ou Escritório e a coordenação.", "Revise alertas e itens do dia.", "Aplique filtros de período, status e responsável antes de priorizar."]),
        ("Durante o trabalho", ["Abra o processo antes de alterar itens sensíveis.", "Registre comentários e datas reais de cumprimento.", "Use workflows quando a sequência já estiver padronizada."]),
        ("Encerramento", ["Verifique prazos fatais, audiências futuras e itens ainda sem responsável.", "Use relatórios/exportações quando precisar compartilhar o acompanhamento.", "Não conclua uma série recorrente inteira quando somente uma ocorrência foi cumprida."]),
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