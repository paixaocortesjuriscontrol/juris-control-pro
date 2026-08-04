import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NavLink } from "react-router-dom";
import {
  ArrowRightLeft,
  FolderOpen,
  Table2,
  Upload,
  Mail,
  ClipboardList,
  Scale,
  ShieldCheck,
  FileText,
  Building2,
  Search,
  Tag as TagIcon,
  FileSignature,
  FileSpreadsheet,
  Hash,
  Users,
  Truck,
  Building,
  CheckSquare,
  History,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

type Tool = { label: string; path: string; icon: any; description: string; adminOnly?: boolean };

const groups: { title: string; description: string; tools: Tool[] }[] = [
  {
    title: "Importações Distribuição TST",
    description: "Cargas e atualizações em massa da Distribuição TST — cada operação em sua própria tela.",
    tools: [
      { label: "Importar PDF Certidão", path: "/admin-tst/importar-certidao-pdf", icon: FileSignature, description: "Cadastra novos processos a partir do PDF da Certidão de Distribuição do TST." },
      { label: "Importar Planilha Distribuição", path: "/admin-tst/importar-distribuicao", icon: FileSpreadsheet, description: "Importação principal da planilha de distribuição, lendo todas as abas." },
      { label: "Atualizar Dossiês", path: "/admin-tst/atualizar-dossies", icon: Hash, description: "Atualiza o Nº do dossiê usando o CNJ como chave." },
      { label: "Atualizar Equipe", path: "/admin-tst/atualizar-equipe", icon: Users, description: "Atualiza a equipe responsável usando o Dossiê como chave." },
      { label: "Atualizar Situação de Envio", path: "/admin-tst/atualizar-situacao-envio", icon: Truck, description: "Atualiza Carga I a VII; cadastra processos novos como BENNER=SIM.", adminOnly: true },
      { label: "Resposta Santander", path: "/admin-tst/resposta-santander", icon: Building, description: "Atualiza dados retornados pelo Santander (distribuição, partes, dossiê).", adminOnly: true },
      { label: "Benner SIM (conferência)", path: "/admin-tst/benner-sim", icon: CheckSquare, description: "Marca processos como Benner=SIM em massa a partir de planilha de conferência." },
    ],
  },
  {
    title: "Distribuição TST",
    description: "Cargas, atualizações e marcações em massa da Distribuição TST.",
    tools: [
      { label: "Verificar Outro Escritório", path: "/admin-tst/outro-escritorio", icon: Building2, description: "Importar planilha de migração, verificar processos na base e marcar como Outro Escritório." },
      { label: "Base PCA - TST - Distribuições", path: "/admin-tst/base-pca-distribuicoes", icon: TagIcon, description: "Upload da planilha, localizar Dossiê/Processo na base e aplicar uma TAG em lote." },
      { label: "Auditoria da Distribuição TST", path: "/admin-tst/auditoria-distribuicao", icon: History, description: "Histórico completo de criações, alterações e exclusões: quem alterou, quando, de qual valor para qual valor.", adminOnly: true },
      { label: "Auditoria de Importações em Lote", path: "/admin-tst/auditoria-lotes", icon: ClipboardList, description: "Histórico de tudo que foi gravado em lote pelas ferramentas do Admin. TST, separado por tipo de operação: data/hora, usuário, arquivo e processos afetados.", adminOnly: true },
      { label: "Classificação TST", path: "/classificacao-tst", icon: ShieldCheck, description: "Classificar processos do TST." },
      { label: "Pautas TST", path: "/pautas-tst", icon: Scale, description: "Gerenciar pautas de julgamento do TST." },
    ],
  },
  {
    title: "Benner",
    description: "Geração de cargas, remessas e consultas de dados do Benner.",
    tools: [
      { label: "Carga Benner", path: "/carga-benner", icon: Upload, description: "Gerar planilhas e PDFs de carga para o Benner." },
      { label: "Remessas Benner", path: "/remessas-benner", icon: Mail, description: "Controlar remessas enviadas ao Benner." },
      { label: "Dados Benner", path: "/dados-benner", icon: ClipboardList, description: "Consultar e enriquecer dados do Benner." },
    ],
  },
  {
    title: "Planilhas & Documentos",
    description: "Processamento, higienização e análise de planilhas e documentos.",
    tools: [
      { label: "Planilha TST", path: "/planilha-tst", icon: Table2, description: "Processar e exportar a planilha do TST." },
      { label: "Corrigir Planilha", path: "/corrigir-planilha", icon: FileText, description: "Higienizar e corrigir planilhas." },
      { label: "Analisar Prazos", path: "/analisar-prazos", icon: FolderOpen, description: "Extrair e analisar prazos de documentos Word." },
    ],
  },
  {
    title: "DJEN & Publicações",
    description: "Ferramentas de busca e comparação de publicações no DJEN.",
    tools: [
      { label: "Errata DJEN", path: "/errata-djen", icon: ArrowRightLeft, description: "Comparar publicações e detectar erratas no DJEN." },
      { label: "Busca Publicação", path: "/admin-tst/busca-publicacao", icon: Search, description: "Buscar publicações no DJEN a partir de uma planilha de processos, período e tribunais. Roda nas VPS do servidor." },
    ],
  },
];

export default function AdminTst() {
  const { isAdmin } = useUserRole();
  const visibleGroups = groups
    .map((g) => ({ ...g, tools: g.tools.filter((t) => !t.adminOnly || isAdmin) }))
    .filter((g) => g.tools.length > 0);
  return (
    <MainLayout
      title="Admin. TST"
      subtitle="Ferramentas administrativas do TST: cargas, importações, classificações e utilitários."
    >
      <div className="p-4 lg:p-6 space-y-8">
        {visibleGroups.map((group) => (
          <section key={group.title} className="space-y-3">
            <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{group.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {group.tools.length} {group.tools.length === 1 ? "ferramenta" : "ferramentas"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.tools.map((tool) => (
                <NavLink key={tool.path} to={tool.path} className="group">
                  <Card className="h-full transition-all border-border hover:border-sky-400/60 hover:shadow-md hover:-translate-y-0.5">
                    <CardContent className="p-5 flex items-start gap-4">
                      <div className="w-11 h-11 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center flex-shrink-0 group-hover:bg-sky-500/20 transition-colors">
                        <tool.icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground group-hover:text-sky-400 transition-colors">
                          {tool.label}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </div>
    </MainLayout>
  );
}