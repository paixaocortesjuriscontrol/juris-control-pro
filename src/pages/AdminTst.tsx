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
  Upload as UploadIcon,
  Building2,
  Search,
  Tag as TagIcon,
} from "lucide-react";

type Tool = { label: string; path: string; icon: any; description: string };

const groups: { title: string; description: string; tools: Tool[] }[] = [
  {
    title: "Distribuição TST",
    description: "Cargas, atualizações e marcações em massa da Distribuição TST.",
    tools: [
      { label: "Importações Distribuição TST", path: "/admin-tst/importacoes-distribuicao", icon: UploadIcon, description: "Cargas e atualizações em massa da Distribuição TST (planilhas e PDFs) com layout documentado." },
      { label: "Verificar Outro Escritório", path: "/admin-tst/outro-escritorio", icon: Building2, description: "Importar planilha de migração, verificar processos na base e marcar como Outro Escritório." },
      { label: "Base PCA - TST - Distribuições", path: "/admin-tst/base-pca-distribuicoes", icon: TagIcon, description: "Upload da planilha, localizar Dossiê/Processo na base e aplicar uma TAG em lote." },
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
  return (
    <MainLayout
      title="Admin. TST"
      subtitle="Ferramentas administrativas do TST: cargas, importações, classificações e utilitários."
    >
      <div className="p-4 lg:p-6 space-y-8">
        {groups.map((group) => (
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