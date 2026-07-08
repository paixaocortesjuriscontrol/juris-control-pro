import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";

const tools = [
  { label: "Errata DJEN", path: "/errata-djen", icon: ArrowRightLeft, description: "Comparar publicações e detectar erratas no DJEN." },
  { label: "Analisar Prazos", path: "/analisar-prazos", icon: FolderOpen, description: "Extrair e analisar prazos de documentos Word." },
  { label: "Planilha TST", path: "/planilha-tst", icon: Table2, description: "Processar e exportar a planilha do TST." },
  { label: "Carga Benner", path: "/carga-benner", icon: Upload, description: "Gerar planilhas e PDFs de carga para o Benner." },
  { label: "Remessas Benner", path: "/remessas-benner", icon: Mail, description: "Controlar remessas enviadas ao Benner." },
  { label: "Dados Benner", path: "/dados-benner", icon: ClipboardList, description: "Consultar e enriquecer dados do Benner." },
  { label: "Pautas TST", path: "/pautas-tst", icon: Scale, description: "Gerenciar pautas de julgamento do TST." },
  { label: "Classificação TST", path: "/classificacao-tst", icon: ShieldCheck, description: "Classificar processos do TST." },
  { label: "Corrigir Planilha", path: "/corrigir-planilha", icon: FileText, description: "Higienizar e corrigir planilhas." },
  { label: "Importações Distribuição TST", path: "/admin-tst/importacoes-distribuicao", icon: UploadIcon, description: "Cargas e atualizações em massa da Distribuição TST (planilhas e PDFs) com layout documentado." },
  { label: "Verificar Outro Escritório", path: "/admin-tst/outro-escritorio", icon: Building2, description: "Importar planilha de migração, verificar processos na base e marcar como Outro Escritório." },
  { label: "Busca Publicação", path: "/admin-tst/busca-publicacao", icon: Search, description: "Buscar publicações no DJEN a partir de uma planilha de processos, período e tribunais. Roda nas VPS do servidor." },
];

export default function AdminTst() {
  return (
    <MainLayout title="Admin. TST">
      <div className="p-4 lg:p-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          Ferramentas administrativas do TST agrupadas em um só lugar.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
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
      </div>
    </MainLayout>
  );
}