import {
  Trophy,
  LayoutDashboard,
  Scale,
  Users,
  FileText,
  ShieldCheck,
  Newspaper,
  UserCircle,
  Brain,
  Library,
  BookOpen,
  LayoutPanelTop,
  ArrowRightLeft,
  FileDiff,
  Sparkles,
  Mail,
  Server,
  History,
  Tag,
  BarChart3,
  Bell,
  Radar,
  Workflow,
} from "lucide-react";

export type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  highlight?: boolean;
  color?: string;
  adminOnly?: boolean;
  adminOrCoordOnly?: boolean;
  restrictedCoordenacoes?: string[];
};

// Itens visíveis para todos os usuários autenticados
export const menuItemsPublicos: MenuItem[] = [
  // Itens destacados (amarelo) - mais utilizados
  { icon: LayoutPanelTop, label: "Painel de Controle", path: "/painel-controle", highlight: true },
  { icon: Radar, label: "Monitoramento", path: "/monitoramento", highlight: true },
  { icon: Scale, label: "Processos e Casos", path: "/processos", highlight: true },
  { icon: Newspaper, label: "Análise DJEN", path: "/analise-djen", highlight: true },
  { icon: BarChart3, label: "Indicadores", path: "/indicadores" },
  { icon: Trophy, label: "Ranking Atendimento", path: "/ranking-atendimento", adminOrCoordOnly: true },
  { icon: Users, label: "Coordenações", path: "/coordenacoes", adminOrCoordOnly: true },
  { icon: Bell, label: "Config. Notificações", path: "/notificacoes" },
  { icon: FileText, label: "Rel. Auditoria", path: "/auditoria-itens", adminOrCoordOnly: true },
  { icon: Workflow, label: "Workflow", path: "/workflow", adminOrCoordOnly: true },
  { icon: ArrowRightLeft, label: "Comparar DJEN", path: "/comparar-dj-santander", highlight: true, adminOnly: true },
  { icon: BookOpen, label: "Termos DJEN", path: "/termos-djen", highlight: true, adminOrCoordOnly: true },
  { icon: Tag, label: "Etiquetas", path: "/etiquetas", highlight: true },
  // Demais itens
  { icon: Scale, label: "Distribuição TST", path: "/distribuicao-tst", color: "text-sky-400", restrictedCoordenacoes: ["Coordenação Dra. Renata com termos do João", "Dr. Renata com termos do João", "Coordenação Dra. Renata Santander"] },
  { icon: FileDiff, label: "Compara Docs TST", path: "/compara-docs-tst", color: "text-sky-400", restrictedCoordenacoes: ["Coordenação Dra. Renata com termos do João", "Dr. Renata com termos do João", "Coordenação Dra. Renata Santander"] },
  { icon: Mail, label: "Remessas Benner", path: "/remessas-benner", color: "text-sky-400", adminOnly: true },
  { icon: BookOpen, label: "Matérias Benner", path: "/materias-benner", color: "text-sky-400", restrictedCoordenacoes: ["Dr. Renata com termos do João", "Coordenação Dra. Renata Santander"] },
  { icon: ShieldCheck, label: "Admin. TST", path: "/admin-tst", color: "text-sky-400", adminOnly: true },
  { icon: Sparkles, label: "Prompt IA TST", path: "/prompts-ia-tst", color: "text-purple-400", adminOnly: true },
  { icon: Sparkles, label: "Prompt IA (Publicações)", path: "/prompt-ia-publicacoes", color: "text-purple-400", adminOrCoordOnly: true },
  { icon: Library, label: "Repositório IA", path: "/repositorio", color: "text-sky-400", adminOrCoordOnly: true },
  { icon: UserCircle, label: "Clientes", path: "/clientes" },
  { icon: FileText, label: "Documentos", path: "/documentos" },
  { icon: BookOpen, label: "Manual Sistema", path: "/manual-sistema", color: "text-sky-400" },
  { icon: Brain, label: "Assistente IA", path: "/assistente-juridico", adminOnly: true },
  { icon: Server, label: "DJEN Servidor", path: "/djen-servidor", color: "text-emerald-400", adminOnly: true },
  { icon: FileText, label: "Análise DJEN Servidor", path: "/analise-djen-servidor", color: "text-emerald-400", adminOnly: true },
  { icon: Server, label: "DJEN Local", path: "/djen-local", color: "text-emerald-400", adminOnly: true },
];

// Itens visíveis apenas para administradores/coordenadores (na seção inferior)
export const menuItemsAdmin: MenuItem[] = [
  { icon: ShieldCheck, label: "Administração", path: "/admin", adminOnly: true },
  { icon: History, label: "Auditoria de Itens", path: "/auditoria-itens", adminOrCoordOnly: true },
  { icon: Server, label: "Pool de Proxies DJEN", path: "/pool-proxy-djen", adminOnly: true },
  { icon: ArrowRightLeft, label: "Valida Kurier", path: "/valida-kurier", adminOnly: true },
];

export const allMenuItems: MenuItem[] = [...menuItemsPublicos, ...menuItemsAdmin];