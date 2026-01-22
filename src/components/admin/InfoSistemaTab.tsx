import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileDown,
  Server,
  Database,
  Mail,
  MessageCircle,
  Cloud,
  Shield,
  Code,
  Table,
  Menu,
  Loader2,
  CheckCircle2,
  Info,
  ExternalLink,
  Activity,
  RefreshCw,
  Search,
  FileText,
  Scale,
  Clock,
  Zap,
  AlertTriangle,
  ArrowRightLeft,
  Newspaper,
  Target,
} from "lucide-react";
import { toast } from "sonner";

interface SystemInfo {
  category: string;
  icon: React.ReactNode;
  items: {
    name: string;
    description: string;
    value?: string;
    badge?: string;
    badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  }[];
}

interface MenuInfo {
  name: string;
  path: string;
  description: string;
  tables?: string[];
}

interface TableInfo {
  name: string;
  description: string;
  columns: string[];
}

const systemInfoData: SystemInfo[] = [
  {
    category: "Frontend - Tecnologias",
    icon: <Code className="w-5 h-5" />,
    items: [
      {
        name: "React",
        description: "Biblioteca JavaScript para construção de interfaces de usuário reativas e componentizadas.",
        value: "v18.3.1",
        badge: "Core",
        badgeVariant: "default",
      },
      {
        name: "TypeScript",
        description: "Superset do JavaScript que adiciona tipagem estática, melhorando a manutenibilidade e segurança do código.",
        value: "v5.x",
        badge: "Linguagem",
        badgeVariant: "secondary",
      },
      {
        name: "Vite",
        description: "Ferramenta de build moderna e rápida para desenvolvimento frontend, com Hot Module Replacement (HMR).",
        value: "v5.x",
        badge: "Build Tool",
        badgeVariant: "secondary",
      },
      {
        name: "Tailwind CSS",
        description: "Framework CSS utilitário para estilização rápida e consistente, com design responsivo.",
        value: "v3.x",
        badge: "Estilização",
        badgeVariant: "secondary",
      },
      {
        name: "shadcn/ui",
        description: "Biblioteca de componentes UI acessíveis e personalizáveis, baseada em Radix UI.",
        badge: "UI Components",
        badgeVariant: "secondary",
      },
      {
        name: "React Router DOM",
        description: "Biblioteca para roteamento e navegação entre páginas no React.",
        value: "v6.30.1",
        badge: "Navegação",
        badgeVariant: "secondary",
      },
      {
        name: "TanStack Query",
        description: "Gerenciamento de estado assíncrono e cache de dados do servidor.",
        value: "v5.83.0",
        badge: "Data Fetching",
        badgeVariant: "secondary",
      },
      {
        name: "Recharts",
        description: "Biblioteca para criação de gráficos e visualizações de dados interativos.",
        value: "v2.15.4",
        badge: "Gráficos",
        badgeVariant: "secondary",
      },
      {
        name: "date-fns",
        description: "Biblioteca para manipulação e formatação de datas.",
        value: "v3.6.0",
        badge: "Utilitários",
        badgeVariant: "outline",
      },
      {
        name: "Zod",
        description: "Biblioteca para validação de schemas e tipos em runtime.",
        value: "v3.25.76",
        badge: "Validação",
        badgeVariant: "outline",
      },
      {
        name: "React Hook Form",
        description: "Biblioteca para gerenciamento de formulários com validação.",
        value: "v7.61.1",
        badge: "Formulários",
        badgeVariant: "outline",
      },
      {
        name: "Lucide React",
        description: "Biblioteca de ícones SVG modernos e consistentes.",
        value: "v0.462.0",
        badge: "Ícones",
        badgeVariant: "outline",
      },
      {
        name: "Sonner",
        description: "Biblioteca para notificações toast elegantes e acessíveis.",
        value: "v1.7.4",
        badge: "Notificações",
        badgeVariant: "outline",
      },
      {
        name: "xlsx",
        description: "Biblioteca para leitura e escrita de arquivos Excel (.xlsx).",
        value: "v0.18.5",
        badge: "Importação",
        badgeVariant: "outline",
      },
    ],
  },
  {
    category: "Backend - Supabase",
    icon: <Database className="w-5 h-5" />,
    items: [
      {
        name: "Supabase",
        description: "Plataforma Backend-as-a-Service (BaaS) open source, alternativa ao Firebase. Fornece banco de dados PostgreSQL, autenticação, storage e Edge Functions.",
        badge: "Infraestrutura",
        badgeVariant: "default",
      },
      {
        name: "PostgreSQL",
        description: "Banco de dados relacional robusto e escalável, gerenciado pelo Supabase.",
        badge: "Banco de Dados",
        badgeVariant: "default",
      },
      {
        name: "Row Level Security (RLS)",
        description: "Políticas de segurança a nível de linha que controlam o acesso aos dados com base no usuário autenticado.",
        badge: "Segurança",
        badgeVariant: "destructive",
      },
      {
        name: "Edge Functions",
        description: "Funções serverless escritas em TypeScript/Deno que executam na borda, próximas aos usuários.",
        badge: "Serverless",
        badgeVariant: "secondary",
      },
      {
        name: "Supabase Auth",
        description: "Sistema de autenticação completo com suporte a email/senha, OAuth e SSO.",
        badge: "Autenticação",
        badgeVariant: "secondary",
      },
      {
        name: "Supabase Storage",
        description: "Armazenamento de arquivos com políticas de acesso e CDN integrado.",
        badge: "Storage",
        badgeVariant: "secondary",
      },
      {
        name: "Realtime",
        description: "Funcionalidade de sincronização em tempo real via WebSockets.",
        badge: "Tempo Real",
        badgeVariant: "outline",
      },
    ],
  },
  {
    category: "Integrações Externas",
    icon: <Cloud className="w-5 h-5" />,
    items: [
      {
        name: "Resend",
        description: "Serviço de envio de emails transacionais. Utilizado para notificações de eventos, alertas de audiências e comunicações do sistema.",
        badge: "Email",
        badgeVariant: "default",
      },
      {
        name: "Z-API",
        description: "API para envio de mensagens WhatsApp. Utilizado para notificações instantâneas de audiências, prazos e alertas importantes.",
        badge: "WhatsApp",
        badgeVariant: "default",
      },
      {
        name: "OpenAI",
        description: "API de inteligência artificial para análise de documentos, resumo de publicações e assistente jurídico.",
        badge: "IA",
        badgeVariant: "default",
      },
      {
        name: "Jina AI",
        description: "API para extração de conteúdo de páginas web, utilizada no monitoramento de publicações do DJEN.",
        badge: "Web Scraping",
        badgeVariant: "secondary",
      },
      {
        name: "Lovable",
        description: "Plataforma de desenvolvimento assistida por IA onde o sistema foi construído. Gerencia deploy, hosting e CI/CD.",
        badge: "Plataforma",
        badgeVariant: "secondary",
      },
    ],
  },
  {
    category: "Segurança e Autenticação",
    icon: <Shield className="w-5 h-5" />,
    items: [
      {
        name: "Autenticação JWT",
        description: "Tokens JSON Web Token para autenticação segura de usuários.",
        badge: "Auth",
        badgeVariant: "default",
      },
      {
        name: "Perfis de Usuário",
        description: "Sistema de roles (admin, coordenador, advogado, estagiário, assistente, secretária) que controlam o acesso às funcionalidades.",
        badge: "RBAC",
        badgeVariant: "default",
      },
      {
        name: "RLS Policies",
        description: "Políticas de Row Level Security que garantem que usuários só acessem dados permitidos.",
        badge: "Banco de Dados",
        badgeVariant: "destructive",
      },
      {
        name: "Secrets Management",
        description: "Chaves de API e tokens armazenados de forma segura no Supabase Vault.",
        badge: "Secrets",
        badgeVariant: "destructive",
      },
    ],
  },
];

const menuInfoData: MenuInfo[] = [
  {
    name: "Dashboard",
    path: "/",
    description: "Painel principal com estatísticas gerais do escritório: total de processos, processos ativos, distribuídos, prazos urgentes. Gráficos de distribuição por coordenação e status.",
    tables: ["processos", "prazos", "coordenacoes", "profiles"],
  },
  {
    name: "Minha Agenda",
    path: "/minha-agenda",
    description: "Agenda pessoal do usuário com eventos, reuniões, audiências e compromissos. Suporte a alertas via email e WhatsApp.",
    tables: ["eventos_agenda", "participantes_evento", "alertas_evento"],
  },
  {
    name: "Painel Audiências",
    path: "/painel-audiencias",
    description: "Gerenciamento de audiências detectadas via monitoramento do DJEN. Cadastro manual, atribuição de advogados e configuração de alertas.",
    tables: ["audiencias_detectadas", "audiencias_advogados", "alertas_audiencias", "lembretes_audiencia", "config_alertas_audiencias"],
  },
  {
    name: "Coordenações",
    path: "/coordenacoes",
    description: "Gestão das coordenações do escritório, distribuição de processos entre membros e delegação de tarefas.",
    tables: ["coordenacoes", "membros_coordenacao", "processos", "prazos"],
  },
  {
    name: "Painel da Equipe",
    path: "/painel-equipe",
    description: "Visão consolidada das tarefas e prazos da equipe, permitindo acompanhamento da produtividade e redistribuição de trabalho.",
    tables: ["prazos", "processos", "profiles", "coordenacoes"],
  },
  {
    name: "Processos Internos",
    path: "/processos",
    description: "Listagem completa de processos com filtros avançados, visualização de detalhes, movimentações e documentos vinculados.",
    tables: ["processos", "movimentacoes", "documentos", "clientes", "coordenacoes"],
  },
  {
    name: "Importar Processos",
    path: "/importar",
    description: "Importação em lote de processos via planilha Excel. Suporta múltiplos formatos e campos personalizados.",
    tables: ["processos", "clientes"],
  },
  {
    name: "Importar Tarefas",
    path: "/importar-tarefas",
    description: "Importação de tarefas/prazos do sistema Projuris via planilha Excel.",
    tables: ["prazos", "processos"],
  },
  {
    name: "Análise DJEN",
    path: "/analise-djen",
    description: "Análise de publicações do Diário de Justiça Eletrônico Nacional com resumo automático via IA.",
    tables: ["publicacoes_djen", "publicacoes_djen_processos"],
  },
  {
    name: "Buscar DJEN",
    path: "/buscar-djen",
    description: "Busca manual de publicações no DJEN por termo, OAB ou número de processo.",
    tables: ["publicacoes_djen"],
  },
  {
    name: "Monit. DJEN",
    path: "/monitoramento-djen",
    description: "Configuração de monitoramentos automáticos do DJEN por termo, OAB ou cliente.",
    tables: ["monitoramentos_djen", "publicacoes_djen", "audiencias_detectadas"],
  },
  {
    name: "Minhas Tarefas",
    path: "/minha-carteira",
    description: "Kanban pessoal de tarefas do usuário logado, com visualização por status e prioridade.",
    tables: ["prazos", "processos", "comentarios_prazos"],
  },
  {
    name: "Notificações",
    path: "/notificacoes",
    description: "Central de notificações do sistema com alertas de prazos, audiências e atualizações de processos.",
    tables: ["notificacoes"],
  },
  {
    name: "Pastas",
    path: "/pastas",
    description: "Organização de processos em pastas por cliente ou coordenação, com upload de documentos.",
    tables: ["pastas", "documentos", "processos"],
  },
  {
    name: "Clientes",
    path: "/clientes",
    description: "Cadastro e gestão de clientes do escritório, com agrupamento e histórico de processos.",
    tables: ["clientes", "grupos_clientes", "clientes_grupos", "processos"],
  },
  {
    name: "Prazos",
    path: "/prazos",
    description: "Calendário de prazos processuais com visualização mensal, filtros e alertas.",
    tables: ["prazos", "processos", "comentarios_prazos"],
  },
  {
    name: "Redistribuições",
    path: "/redistribuicoes",
    description: "Monitoramento de redistribuições de processos nos tribunais.",
    tables: ["processos", "movimentacoes"],
  },
  {
    name: "Monit. Distribuição",
    path: "/monitoramento-distribuicao",
    description: "Monitoramento de novas distribuições nos tribunais por nome de parte.",
    tables: ["monitoramentos_distribuicao", "distribuicoes_encontradas"],
  },
  {
    name: "Monitoração 360º",
    path: "/monitoramento-360",
    description: "Painel consolidado de todos os monitoramentos ativos com alertas e carteiras de processos.",
    tables: ["carteiras_processos", "termos_monitoramento", "alertas_monitoramento"],
  },
  {
    name: "Buscar Processos",
    path: "/buscar",
    description: "Busca interna de processos no banco de dados do sistema.",
    tables: ["processos"],
  },
  {
    name: "Consulta Externa",
    path: "/consulta-externa",
    description: "Consulta de processos diretamente nos sistemas dos tribunais via API.",
    tables: [],
  },
  {
    name: "Buscar PJE",
    path: "/buscar-pje",
    description: "Busca de processos no PJE (Processo Judicial Eletrônico).",
    tables: ["monitoramentos_pje"],
  },
  {
    name: "Documentos",
    path: "/documentos",
    description: "Repositório de documentos vinculados a processos.",
    tables: ["documentos", "processos"],
  },
  {
    name: "Repositório IA",
    path: "/repositorio",
    description: "Repositório de documentos com análise inteligente via IA, permitindo chat com os documentos.",
    tables: ["documentos"],
  },
  {
    name: "Assistente IA",
    path: "/assistente-juridico",
    description: "Chat com assistente jurídico baseado em IA para consultas e análises.",
    tables: [],
  },
  {
    name: "Relatórios",
    path: "/relatorios",
    description: "Relatórios gerenciais com gráficos e estatísticas do escritório, exportáveis em PDF.",
    tables: ["processos", "prazos", "movimentacoes", "clientes"],
  },
  {
    name: "Administração",
    path: "/admin",
    description: "Gestão de usuários, perfis e histórico de acesso ao sistema. Restrito a administradores.",
    tables: ["profiles", "user_roles", "historico_login"],
  },
  {
    name: "Configurações",
    path: "/configuracoes",
    description: "Configurações gerais do sistema, monitoramentos e integrações.",
    tables: ["configuracoes_monitoramento"],
  },
];

const tableInfoData: TableInfo[] = [
  {
    name: "processos",
    description: "Armazena todos os processos judiciais do escritório com informações completas.",
    columns: ["id", "numero", "area", "status", "polo_ativo", "polo_passivo", "tribunal", "vara", "comarca", "valor_causa", "cliente_id", "coordenacao_id", "advogado_responsavel_id", "created_at", "updated_at"],
  },
  {
    name: "profiles",
    description: "Perfis de usuários do sistema com informações pessoais e profissionais.",
    columns: ["id", "nome", "email", "oab", "telefone", "filial", "avatar_url", "ativo", "created_at"],
  },
  {
    name: "user_roles",
    description: "Roles (perfis de acesso) dos usuários.",
    columns: ["id", "user_id", "role", "created_at"],
  },
  {
    name: "coordenacoes",
    description: "Coordenações/equipes do escritório.",
    columns: ["id", "nome", "descricao", "area", "coordenador_id", "created_at", "updated_at"],
  },
  {
    name: "membros_coordenacao",
    description: "Membros de cada coordenação.",
    columns: ["id", "coordenacao_id", "usuario_id", "cargo", "created_at"],
  },
  {
    name: "clientes",
    description: "Clientes do escritório.",
    columns: ["id", "nome", "tipo", "cpf_cnpj", "email", "telefone", "endereco", "observacoes", "created_at", "updated_at"],
  },
  {
    name: "grupos_clientes",
    description: "Grupos para organização de clientes.",
    columns: ["id", "nome", "descricao", "cor", "created_at", "updated_at"],
  },
  {
    name: "prazos",
    description: "Prazos e tarefas vinculados a processos.",
    columns: ["id", "titulo", "descricao", "processo_id", "responsavel_id", "status", "prioridade", "data_vencimento", "data_fatal", "created_at", "updated_at"],
  },
  {
    name: "movimentacoes",
    description: "Movimentações/andamentos dos processos.",
    columns: ["id", "processo_id", "descricao", "data_movimentacao", "tipo", "fonte", "created_at"],
  },
  {
    name: "documentos",
    description: "Documentos anexados a processos.",
    columns: ["id", "nome", "url", "tipo", "tamanho_bytes", "processo_id", "pasta_id", "uploaded_by", "created_at"],
  },
  {
    name: "pastas",
    description: "Pastas para organização de processos e documentos.",
    columns: ["id", "nome", "descricao", "cliente_id", "coordenacao_id", "status", "criado_por", "created_at", "updated_at"],
  },
  {
    name: "eventos_agenda",
    description: "Eventos da agenda (reuniões, audiências, compromissos).",
    columns: ["id", "titulo", "descricao", "tipo", "data_inicio", "data_fim", "local", "criado_por", "processo_id", "status", "enviar_whatsapp", "recorrente", "created_at", "updated_at"],
  },
  {
    name: "participantes_evento",
    description: "Participantes de cada evento da agenda.",
    columns: ["id", "evento_id", "usuario_id", "notificar", "created_at"],
  },
  {
    name: "alertas_evento",
    description: "Alertas configurados para eventos.",
    columns: ["id", "evento_id", "minutos_antes", "enviado", "enviado_em", "created_at"],
  },
  {
    name: "audiencias_detectadas",
    description: "Audiências detectadas via monitoramento do DJEN.",
    columns: ["id", "processo_numero", "data_audiencia", "hora", "tipo_audiencia", "local_audiencia", "status", "cliente", "advogado", "monitoramento_id", "created_at", "updated_at"],
  },
  {
    name: "monitoramentos_djen",
    description: "Configurações de monitoramento do DJEN.",
    columns: ["id", "termo_busca", "tipo", "uf", "tribunais", "oab", "ativo", "coordenacao_id", "criado_por", "created_at", "updated_at"],
  },
  {
    name: "publicacoes_djen",
    description: "Publicações encontradas no DJEN.",
    columns: ["id", "caderno", "data_publicacao", "conteudo", "resumo_ia", "monitoramento_id", "created_at"],
  },
  {
    name: "notificacoes",
    description: "Notificações do sistema para usuários.",
    columns: ["id", "usuario_id", "titulo", "mensagem", "tipo", "link", "lida", "dados", "created_at"],
  },
  {
    name: "historico_login",
    description: "Histórico de acessos ao sistema.",
    columns: ["id", "user_id", "email", "ip_address", "user_agent", "logged_in_at"],
  },
  {
    name: "configuracoes_monitoramento",
    description: "Configurações gerais de monitoramentos.",
    columns: ["id", "tipo", "ativo", "frequencia", "horarios_execucao", "coordenacao_id", "ultima_execucao", "created_at", "updated_at"],
  },
];

const secretsInfo = [
  {
    name: "SUPABASE_URL",
    description: "URL do projeto Supabase para conexão com o banco de dados e APIs.",
    value: "https://bfxahrrvoqxcdmfsvnrk.supabase.co",
    category: "Supabase",
    isPublic: true,
  },
  {
    name: "SUPABASE_ANON_KEY",
    description: "Chave anônima (pública) do Supabase para operações de cliente com RLS. Segura para uso no frontend.",
    value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM",
    category: "Supabase",
    isPublic: true,
  },
  {
    name: "SUPABASE_PUBLISHABLE_KEY",
    description: "Chave publicável do Supabase, idêntica à ANON_KEY. Utilizada no frontend para autenticação e queries.",
    value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM",
    category: "Supabase",
    isPublic: true,
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    description: "Chave de serviço do Supabase com bypass de RLS. Usada exclusivamente em Edge Functions para operações administrativas. NUNCA expor no frontend.",
    value: "🔒 Armazenada de forma segura no Supabase Vault",
    category: "Supabase",
    isPublic: false,
  },
  {
    name: "SUPABASE_DB_URL",
    description: "URL de conexão direta ao banco PostgreSQL do Supabase para operações de banco.",
    value: "postgresql://postgres:[PASSWORD]@db.bfxahrrvoqxcdmfsvnrk.supabase.co:5432/postgres",
    category: "Supabase",
    isPublic: false,
  },
  {
    name: "RESEND_API_KEY",
    description: "Chave de API do Resend para envio de emails transacionais (notificações de audiências, alertas de prazos, lembretes de eventos).",
    value: "🔒 Armazenada de forma segura no Supabase Vault",
    category: "Email",
    isPublic: false,
  },
  {
    name: "OPENAI_API_KEY",
    description: "Chave de API da OpenAI (GPT-4) para funcionalidades de IA: resumos de publicações DJEN, análise de documentos jurídicos e assistente jurídico inteligente.",
    value: "🔒 Armazenada de forma segura no Supabase Vault",
    category: "Inteligência Artificial",
    isPublic: false,
  },
  {
    name: "JINA_API_KEY",
    description: "Chave de API do Jina AI para extração de conteúdo de páginas web (web scraping) no monitoramento do DJEN e backfill de publicações.",
    value: "🔒 Armazenada de forma segura no Supabase Vault",
    category: "Inteligência Artificial",
    isPublic: false,
  },
  {
    name: "ZAPI_INSTANCE_ID",
    description: "ID da instância Z-API para integração com WhatsApp. Identifica a conexão específica do escritório com o gateway WhatsApp.",
    value: "🔒 Armazenada de forma segura no Supabase Vault",
    category: "WhatsApp",
    isPublic: false,
  },
  {
    name: "ZAPI_TOKEN",
    description: "Token de autenticação da Z-API para envio de mensagens WhatsApp (notificações de audiências, alertas de eventos).",
    value: "🔒 Armazenada de forma segura no Supabase Vault",
    category: "WhatsApp",
    isPublic: false,
  },
  {
    name: "ZAPI_CLIENT_TOKEN",
    description: "Token do cliente Z-API obrigatório para webhooks e callbacks. Usado nas Edge Functions para autenticação nas requisições à API.",
    value: "🔒 Armazenada de forma segura no Supabase Vault",
    category: "WhatsApp",
    isPublic: false,
  },
  {
    name: "LOVABLE_API_KEY",
    description: "Chave de API do Lovable para integrações e funcionalidades da plataforma de desenvolvimento onde o sistema foi construído.",
    value: "🔒 Armazenada de forma segura no Supabase Vault",
    category: "Plataforma",
    isPublic: false,
  },
];

const edgeFunctionsInfo = [
  { name: "alertar-audiencias", description: "Processa e envia alertas de audiências próximas." },
  { name: "analisar-documento", description: "Analisa documentos usando IA para extração de informações." },
  { name: "analisar-publicacao-ia", description: "Analisa publicações do DJEN com IA para detecção de audiências e prazos." },
  { name: "atualizar-cron-monitoramento", description: "Atualiza configurações de cron jobs de monitoramento." },
  { name: "atualizar-usuario", description: "Atualiza dados de usuários com permissões elevadas." },
  { name: "backfill-djen", description: "Processa backfill de publicações do DJEN." },
  { name: "backfill-djen-jina", description: "Extração de conteúdo via Jina AI para backfill." },
  { name: "backfill-djen-job", description: "Gerencia jobs de backfill do DJEN." },
  { name: "buscar-djen", description: "Busca publicações no DJEN." },
  { name: "buscar-eprocesso", description: "Busca processos no e-Processo/e-SAJ." },
  { name: "buscar-pje", description: "Busca processos no PJE." },
  { name: "cadastrar-equipe", description: "Cadastro de membros em coordenações." },
  { name: "cadastrar-perfil", description: "Cadastro de perfis de usuários." },
  { name: "cadastrar-perfis-lote", description: "Cadastro em lote de perfis de usuários." },
  { name: "capturar-intimacoes", description: "Captura intimações do PJE Comunica." },
  { name: "capturar-processo-tribunal", description: "Captura dados de processo direto do tribunal." },
  { name: "consultar-processo", description: "Consulta dados de processos em tribunais via DataJud/CNJ." },
  { name: "enviar-alertas-360-email", description: "Envia alertas da Monitoração 360 por email." },
  { name: "enviar-convite-cliente", description: "Envia convite de acesso ao portal do cliente." },
  { name: "enviar-whatsapp-zapi", description: "Envia mensagens WhatsApp via Z-API." },
  { name: "executar-monitoramento", description: "Orquestrador central que gerencia a execução de todos os monitoramentos." },
  { name: "limpar-djen-hoje", description: "Limpa publicações DJEN do dia atual para reprocessamento." },
  { name: "monitorar-andamentos", description: "Monitora novos andamentos em processos via API DataJud." },
  { name: "monitorar-distribuicoes", description: "Monitora novas distribuições nos tribunais por termo de busca." },
  { name: "monitorar-djen", description: "Monitora publicações no DJEN por monitoramento configurado." },
  { name: "monitorar-djen-processos", description: "Monitora publicações do DJEN para processos cadastrados." },
  { name: "monitorar-pje", description: "Monitora processos no PJE." },
  { name: "monitorar-redistribuicoes", description: "Detecta mudanças de vara/redistribuições em processos." },
  { name: "monitorar-termos", description: "Monitora termos específicos da Monitoração 360." },
  { name: "notificar-evento", description: "Envia notificações de eventos via email (Resend)." },
  { name: "processar-alertas-djen-coordenacao", description: "Processa alertas DJEN por coordenação." },
  { name: "processar-alertas-evento", description: "Processa alertas agendados de eventos." },
  { name: "processar-alertas-parcela", description: "Processa alertas de parcelas financeiras." },
  { name: "processar-lembretes-audiencia", description: "Processa lembretes de audiências detectadas." },
  { name: "repositorio-chat", description: "Chat com documentos do repositório via IA (OpenAI)." },
  { name: "resumir-publicacoes", description: "Resume publicações DJEN usando IA para facilitar triagem." },
];

// ===================== MONITORAMENTOS - DOCUMENTAÇÃO DETALHADA =====================

interface MonitoramentoInfo {
  id: string;
  nome: string;
  icon: React.ReactNode;
  descricao: string;
  fontesDados: string[];
  tabelasEnvolvidas: string[];
  edgeFunctions: string[];
  frequenciaPadrao: string;
  horarioAgendado: string;
  comoFunciona: string[];
  oQueEncontra: string[];
  limitacoes: string[];
  badge: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
}

const monitoramentosInfo: MonitoramentoInfo[] = [
  {
    id: "redistribuicoes",
    nome: "Redistribuições",
    icon: <ArrowRightLeft className="w-5 h-5" />,
    descricao: "Detecta automaticamente quando um processo do escritório é redistribuído para outra vara ou juízo.",
    fontesDados: ["API DataJud/CNJ"],
    tabelasEnvolvidas: ["processos", "movimentacoes", "notificacoes", "configuracoes_monitoramento", "execucoes_agendadas"],
    edgeFunctions: ["monitorar-redistribuicoes", "executar-monitoramento"],
    frequenciaPadrao: "Diário",
    horarioAgendado: "00:30 BRT",
    comoFunciona: [
      "Consulta todos os processos ativos cadastrados no sistema",
      "Para cada processo, faz uma requisição à API pública do DataJud/CNJ",
      "Compara a vara atual no banco com a vara retornada pela API",
      "Se houver diferença, registra uma movimentação do tipo 'Redistribuição'",
      "Cria notificação para o responsável pelo processo",
      "Atualiza os dados do processo com a nova vara",
    ],
    oQueEncontra: [
      "Mudanças de vara/juízo (redistribuição propriamente dita)",
      "Mudanças de competência entre varas especializadas",
      "Redistribuições por motivo de prevenção",
    ],
    limitacoes: [
      "Depende dos processos já estarem cadastrados no sistema",
      "A API do CNJ pode ter atraso de algumas horas/dias",
      "Não detecta redistribuições em processos não cadastrados",
    ],
    badge: "DataJud",
    badgeVariant: "default",
  },
  {
    id: "andamentos",
    nome: "Andamentos",
    icon: <Activity className="w-5 h-5" />,
    descricao: "Monitora novos andamentos processuais nos tribunais para processos já cadastrados no sistema.",
    fontesDados: ["API DataJud/CNJ"],
    tabelasEnvolvidas: ["processos", "movimentacoes", "notificacoes", "configuracoes_monitoramento", "execucoes_agendadas"],
    edgeFunctions: ["monitorar-andamentos", "executar-monitoramento"],
    frequenciaPadrao: "Diário",
    horarioAgendado: "23:00 BRT",
    comoFunciona: [
      "Consulta processos ativos que possuem monitoramento de andamentos ativado",
      "Para cada processo, busca os últimos movimentos na API DataJud",
      "Compara com movimentações já registradas no banco (deduplicação)",
      "Insere apenas movimentações novas que ainda não existem",
      "Pode criar tarefas automáticas para movimentações importantes",
    ],
    oQueEncontra: [
      "Despachos e decisões",
      "Publicações de intimações",
      "Movimentações de protocolo",
      "Sentenças e acórdãos",
      "Qualquer movimentação registrada no tribunal",
    ],
    limitacoes: [
      "Restrito a processos já cadastrados com monitoramento ativo",
      "Dados dependem da atualização do tribunal na base do CNJ",
      "Alguns tribunais podem ter atraso maior na sincronização",
    ],
    badge: "DataJud",
    badgeVariant: "default",
  },
  {
    id: "distribuicoes",
    nome: "Distribuições",
    icon: <Search className="w-5 h-5" />,
    descricao: "Busca novas distribuições nos tribunais baseado em termos configurados (nome, CPF, CNPJ, OAB).",
    fontesDados: ["API DataJud/CNJ"],
    tabelasEnvolvidas: ["monitoramentos_distribuicao", "distribuicoes_encontradas", "processos", "notificacoes", "configuracoes_monitoramento"],
    edgeFunctions: ["monitorar-distribuicoes", "executar-monitoramento"],
    frequenciaPadrao: "Diário",
    horarioAgendado: "03:30 BRT",
    comoFunciona: [
      "Lê os monitoramentos configurados na tabela 'monitoramentos_distribuicao'",
      "Para cada monitoramento ativo, monta uma query Elasticsearch",
      "Busca na API DataJud processos distribuídos nos últimos 30 dias",
      "Filtra por tipo: CPF/CNPJ (documento), OAB (advogado), Nome (parte)",
      "Verifica se o processo já existe no sistema (deduplicação)",
      "Salva novos processos encontrados em 'distribuicoes_encontradas' com status 'pendente'",
      "Usuário pode então importar ou ignorar cada distribuição encontrada",
    ],
    oQueEncontra: [
      "Novos processos onde o termo buscado aparece como parte (ativo ou passivo)",
      "Novos processos onde o advogado (OAB) está cadastrado",
      "Novas ações contra clientes monitorados por CPF/CNPJ",
    ],
    limitacoes: [
      "Depende de configurar termos de busca manualmente",
      "Só encontra processos distribuídos nos últimos 30 dias",
      "Busca em todos os tribunais pode ser demorada",
      "Termos muito genéricos podem retornar muitos falsos positivos",
      "A API do CNJ pode não ter todos os tribunais indexados imediatamente",
    ],
    badge: "DataJud",
    badgeVariant: "secondary",
  },
  {
    id: "djen",
    nome: "DJEN Publicações",
    icon: <Newspaper className="w-5 h-5" />,
    descricao: "Monitora o Diário de Justiça Eletrônico Nacional buscando publicações por termos configurados.",
    fontesDados: ["PJE Comunica", "Jina AI (extração de conteúdo)"],
    tabelasEnvolvidas: ["monitoramentos_djen", "publicacoes_djen", "audiencias_detectadas", "notificacoes", "configuracoes_monitoramento", "parametros_monitoramento_djen"],
    edgeFunctions: ["monitorar-djen", "resumir-publicacoes", "analisar-publicacao-ia", "backfill-djen", "backfill-djen-jina"],
    frequenciaPadrao: "Diário",
    horarioAgendado: "05:00 BRT",
    comoFunciona: [
      "Lê monitoramentos ativos da tabela 'monitoramentos_djen'",
      "Para cada monitoramento, acessa o PJE Comunica buscando pelo termo",
      "Extrai o conteúdo das publicações usando Jina AI (web scraping)",
      "Analisa o conteúdo com OpenAI para detectar audiências e prazos",
      "Registra publicações na tabela 'publicacoes_djen'",
      "Se detectar audiência, cria registro em 'audiencias_detectadas'",
      "Gera notificações para a coordenação responsável",
    ],
    oQueEncontra: [
      "Intimações de audiências",
      "Publicações de despachos",
      "Sentenças e decisões interlocutórias",
      "Citações e notificações",
      "Qualquer publicação que mencione o termo monitorado",
    ],
    limitacoes: [
      "Depende do PJE Comunica estar disponível",
      "Extração via Jina AI pode falhar em páginas muito complexas",
      "Análise de IA pode ter falsos positivos/negativos na detecção de audiências",
      "Publicações muito longas podem ser truncadas",
    ],
    badge: "PJE Comunica",
    badgeVariant: "default",
  },
  {
    id: "djen_processos",
    nome: "DJEN por Processos",
    icon: <FileText className="w-5 h-5" />,
    descricao: "Variação do monitoramento DJEN que busca publicações especificamente para números de processos cadastrados.",
    fontesDados: ["PJE Comunica", "Jina AI"],
    tabelasEnvolvidas: ["processos", "publicacoes_djen_processos", "notificacoes", "configuracoes_monitoramento"],
    edgeFunctions: ["monitorar-djen-processos", "executar-monitoramento"],
    frequenciaPadrao: "Diário",
    horarioAgendado: "02:00 BRT",
    comoFunciona: [
      "Consulta processos ativos que têm monitoramento DJEN habilitado",
      "Para cada processo, busca no PJE Comunica usando o número do processo",
      "Extrai e analisa o conteúdo das publicações encontradas",
      "Vincula as publicações diretamente ao processo",
      "Cria tarefas automáticas quando detecta intimações relevantes",
    ],
    oQueEncontra: [
      "Publicações específicas de cada processo monitorado",
      "Intimações direcionadas ao escritório",
      "Despachos e decisões do processo",
    ],
    limitacoes: [
      "Mais focado que o monitoramento por termo",
      "Depende do número do processo estar correto no formato CNJ",
      "Processos sigilosos podem não aparecer no PJE Comunica",
    ],
    badge: "PJE Comunica",
    badgeVariant: "secondary",
  },
  {
    id: "termos_360",
    nome: "Termos 360°",
    icon: <Target className="w-5 h-5" />,
    descricao: "Monitoramento abrangente que analisa dados internos do sistema buscando por termos e padrões configurados.",
    fontesDados: ["Banco de dados interno (PostgreSQL)"],
    tabelasEnvolvidas: ["termos_monitoramento", "carteiras_processos", "alertas_monitoramento", "processos", "movimentacoes", "configuracoes_monitoramento"],
    edgeFunctions: ["monitorar-termos", "enviar-alertas-360-email", "executar-monitoramento"],
    frequenciaPadrao: "Diário",
    horarioAgendado: "06:00 BRT",
    comoFunciona: [
      "Lê termos configurados na Monitoração 360",
      "Analisa movimentações recentes buscando os termos",
      "Verifica processos em carteiras específicas",
      "Gera alertas quando encontra correspondências",
      "Pode enviar resumo por email para gestores",
    ],
    oQueEncontra: [
      "Padrões de movimentação específicos (ex: 'sentença', 'arquivamento')",
      "Processos em determinadas situações",
      "Alertas customizados baseados em regras do escritório",
    ],
    limitacoes: [
      "Analisa apenas dados já presentes no sistema",
      "Não busca em fontes externas",
      "Eficácia depende da qualidade dos termos configurados",
    ],
    badge: "Interno",
    badgeVariant: "outline",
  },
];

// Informações sobre a arquitetura de execução
const arquiteturaExecucaoInfo = {
  orquestrador: {
    nome: "executar-monitoramento",
    descricao: "Edge Function central que coordena a execução de todos os monitoramentos",
    funcionalidades: [
      "Serializa tarefas pesadas para evitar sobrecarga (WORKER_LIMIT)",
      "Gerencia paginação e continuação entre batches",
      "Detecta heartbeat e marca execuções travadas como timeout",
      "Reseta flags de cancelamento ao iniciar nova execução",
      "Dispara workers em background para tarefas longas",
    ],
  },
  tabelasControle: [
    {
      nome: "configuracoes_monitoramento",
      descricao: "Armazena configuração de cada tipo de monitoramento (frequência, horários, ativo/inativo)",
      campos: ["tipo", "frequencia", "ativo", "horarios_execucao", "metadata", "ultima_execucao"],
    },
    {
      nome: "execucoes_agendadas",
      descricao: "Registra cada execução individual com status, progresso e métricas",
      campos: ["tipo", "status", "iniciado_em", "finalizado_em", "registros_processados", "registros_encontrados", "detalhes"],
    },
    {
      nome: "historico_monitoramento",
      descricao: "Log histórico de execuções para auditoria e relatórios",
      campos: ["tipo", "data_execucao", "registros_processados", "registros_encontrados", "erros", "duracao_segundos"],
    },
  ],
  statusPossiveis: [
    { status: "idle", descricao: "Aguardando próxima execução agendada" },
    { status: "executando", descricao: "Em execução no momento" },
    { status: "concluido", descricao: "Última execução concluída com sucesso" },
    { status: "erro", descricao: "Última execução falhou" },
    { status: "cancelado", descricao: "Execução foi cancelada manualmente" },
    { status: "timeout", descricao: "Execução excedeu tempo limite (5 min sem atividade)" },
  ],
  horariosAgendados: [
    { tipo: "Andamentos", horario: "23:00 BRT", descricao: "Executa à noite para processar movimentações do dia" },
    { tipo: "Redistribuições", horario: "00:30 BRT", descricao: "Executa após meia-noite para dados consolidados" },
    { tipo: "DJEN Processos", horario: "02:00 BRT", descricao: "Madrugada para publicações do dia anterior" },
    { tipo: "Distribuições", horario: "03:30 BRT", descricao: "Busca novas distribuições durante baixo uso" },
    { tipo: "DJEN Publicações", horario: "05:00 BRT", descricao: "Antes do expediente para análise matinal" },
    { tipo: "Termos 360", horario: "06:00 BRT", descricao: "Análise interna antes do início do dia" },
  ],
};

const storageBucketsInfo = [
  { name: "projuris_planilhas", description: "Armazena planilhas importadas do Projuris.", public: true },
  { name: "equipe", description: "Fotos de perfil e arquivos da equipe.", public: true },
  { name: "documentos_processos", description: "Documentos anexados a processos.", public: true },
  { name: "repositorio_documentos", description: "Documentos do repositório com análise IA.", public: false },
];

export function InfoSistemaTab() {
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      // Create a print-friendly version
      const printContent = document.getElementById("system-info-content");
      if (!printContent) {
        toast.error("Erro ao preparar conteúdo para impressão");
        return;
      }

      // Add print styles
      const style = document.createElement("style");
      style.innerHTML = `
        @media print {
          body * { visibility: hidden; }
          #system-info-content, #system-info-content * { visibility: visible; }
          #system-info-content { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
            padding: 20px;
          }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          @page { margin: 1cm; }
        }
      `;
      document.head.appendChild(style);

      window.print();

      // Remove print styles after printing
      setTimeout(() => {
        document.head.removeChild(style);
      }, 1000);

      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar PDF");
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const currentDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      {/* Header with Export Button */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
            <Server className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Informações do Sistema</h2>
            <p className="text-muted-foreground">Documentação técnica para registro</p>
          </div>
        </div>
        <Button onClick={handleExportPdf} disabled={exporting}>
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4 mr-2" />
          )}
          Exportar PDF
        </Button>
      </div>

      {/* Print Content */}
      <div id="system-info-content" ref={printRef}>
        {/* Title for PDF */}
        <div className="hidden print:block mb-8">
          <h1 className="text-3xl font-bold text-center">JurisControl - Documentação Técnica do Sistema</h1>
          <p className="text-center text-muted-foreground mt-2">Paixão Cortes Advogados</p>
          <p className="text-center text-sm text-muted-foreground mt-1">Gerado em: {currentDate}</p>
          <Separator className="mt-4" />
        </div>

        {/* General Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Informações Gerais
            </CardTitle>
            <CardDescription>Dados básicos do sistema para registro em cartório</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Nome do Sistema</p>
                <p className="text-lg font-semibold">JurisControl</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Proprietário</p>
                <p className="text-lg font-semibold">Paixão Cortes Advogados</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Domínio</p>
                <p className="text-lg font-semibold">juriscontrol.adv.br</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Data de Geração</p>
                <p className="text-lg font-semibold">{currentDate}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Plataforma de Hospedagem</p>
                <p className="text-lg font-semibold">Lovable Cloud</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Backend</p>
                <p className="text-lg font-semibold">Supabase (PostgreSQL)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technologies Accordion */}
        <Card className="print-break">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              Tecnologias Utilizadas
            </CardTitle>
            <CardDescription>Stack tecnológico completo do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={systemInfoData.map(s => s.category)} className="w-full">
              {systemInfoData.map((section) => (
                <AccordionItem key={section.category} value={section.category}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      {section.icon}
                      <span>{section.category}</span>
                      <Badge variant="outline" className="ml-2">{section.items.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pl-7">
                      {section.items.map((item) => (
                        <div key={item.name} className="p-3 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.name}</span>
                              {item.value && (
                                <span className="text-xs text-muted-foreground">{item.value}</span>
                              )}
                            </div>
                            {item.badge && (
                              <Badge variant={item.badgeVariant || "secondary"}>{item.badge}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Secrets and Configurations */}
        <Card className="print-break">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Configurações e Secrets
            </CardTitle>
            <CardDescription>Chaves de API e configurações de integrações (valores ocultos por segurança)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {secretsInfo.map((secret) => (
                <div key={secret.name} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-mono text-sm font-medium">{secret.name}</p>
                    <p className="text-sm text-muted-foreground">{secret.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Edge Functions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="w-5 h-5" />
              Edge Functions (Serverless)
            </CardTitle>
            <CardDescription>Funções serverless para processamento backend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {edgeFunctionsInfo.map((func) => (
                <div key={func.name} className="flex items-start gap-2 p-2 rounded border bg-muted/30">
                  <Code className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-mono text-xs font-medium">{func.name}</p>
                    <p className="text-xs text-muted-foreground">{func.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ==================== MONITORAMENTOS - SEÇÃO COMPLETA ==================== */}
        <Card className="print-break">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Sistema de Monitoramentos Automáticos
            </CardTitle>
            <CardDescription>
              Detalhamento completo de cada tipo de monitoramento, fontes de dados e funcionamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Visão Geral */}
            <div className="p-4 rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4" />
                Visão Geral do Sistema
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                O JurisControl possui um sistema robusto de monitoramentos automáticos que executam diariamente 
                em horários escalonados para evitar sobrecarga. Cada monitoramento é gerenciado por um orquestrador 
                central (<code className="bg-muted px-1 rounded">executar-monitoramento</code>) que coordena 
                a execução, controla progresso e gerencia cancelamentos.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                <div className="text-center p-2 rounded bg-background">
                  <p className="text-2xl font-bold text-primary">{monitoramentosInfo.length}</p>
                  <p className="text-xs text-muted-foreground">Tipos de Monitoramento</p>
                </div>
                <div className="text-center p-2 rounded bg-background">
                  <p className="text-2xl font-bold text-primary">3</p>
                  <p className="text-xs text-muted-foreground">Fontes Externas</p>
                </div>
                <div className="text-center p-2 rounded bg-background">
                  <p className="text-2xl font-bold text-primary">24/7</p>
                  <p className="text-xs text-muted-foreground">Monitoramento Contínuo</p>
                </div>
              </div>
            </div>

            {/* Horários Agendados */}
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" />
                Horários de Execução Agendados (Escalonados)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {arquiteturaExecucaoInfo.horariosAgendados.map((h) => (
                  <div key={h.tipo} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <Badge variant="outline" className="font-mono whitespace-nowrap">{h.horario}</Badge>
                    <div>
                      <p className="font-medium text-sm">{h.tipo}</p>
                      <p className="text-xs text-muted-foreground">{h.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detalhamento de cada Monitoramento */}
            <Accordion type="multiple" className="w-full">
              {monitoramentosInfo.map((mon) => (
                <AccordionItem key={mon.id} value={mon.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded bg-primary/10">
                        {mon.icon}
                      </div>
                      <span className="font-semibold">{mon.nome}</span>
                      <Badge variant={mon.badgeVariant}>{mon.badge}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-10 space-y-4">
                      {/* Descrição */}
                      <p className="text-sm text-muted-foreground">{mon.descricao}</p>

                      {/* Info Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border bg-muted/30">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Frequência</p>
                          <p className="font-medium">{mon.frequenciaPadrao}</p>
                          <p className="text-xs text-muted-foreground">Horário: {mon.horarioAgendado}</p>
                        </div>
                        <div className="p-3 rounded-lg border bg-muted/30">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Fontes de Dados</p>
                          <div className="flex flex-wrap gap-1">
                            {mon.fontesDados.map((fonte) => (
                              <Badge key={fonte} variant="secondary" className="text-xs">{fonte}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Como Funciona */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">📋 Como Funciona:</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          {mon.comoFunciona.map((passo, i) => (
                            <li key={i} className="text-muted-foreground">{passo}</li>
                          ))}
                        </ol>
                      </div>

                      {/* O que Encontra */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">✅ O que Encontra:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {mon.oQueEncontra.map((item, i) => (
                            <li key={i} className="text-muted-foreground">{item}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Limitações */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Limitações:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {mon.limitacoes.map((item, i) => (
                            <li key={i} className="text-muted-foreground">{item}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Tabelas e Edge Functions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">🗄️ Tabelas Envolvidas:</p>
                          <div className="flex flex-wrap gap-1">
                            {mon.tabelasEnvolvidas.map((t) => (
                              <Badge key={t} variant="outline" className="text-xs font-mono">{t}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">⚡ Edge Functions:</p>
                          <div className="flex flex-wrap gap-1">
                            {mon.edgeFunctions.map((f) => (
                              <Badge key={f} variant="secondary" className="text-xs font-mono">{f}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {/* Arquitetura de Execução */}
            <div className="p-4 rounded-lg border bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Scale className="w-4 h-4" />
                Arquitetura de Execução
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Orquestrador Central: <code className="bg-background px-1.5 py-0.5 rounded">{arquiteturaExecucaoInfo.orquestrador.nome}</code></p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {arquiteturaExecucaoInfo.orquestrador.funcionalidades.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-2">Tabelas de Controle:</p>
                  <div className="space-y-2">
                    {arquiteturaExecucaoInfo.tabelasControle.map((t) => (
                      <div key={t.nome} className="p-2 rounded border bg-background">
                        <p className="font-mono text-sm font-medium">{t.nome}</p>
                        <p className="text-xs text-muted-foreground mb-1">{t.descricao}</p>
                        <div className="flex flex-wrap gap-1">
                          {t.campos.map((c) => (
                            <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-2">Status Possíveis de Execução:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {arquiteturaExecucaoInfo.statusPossiveis.map((s) => (
                      <div key={s.status} className="p-2 rounded border bg-background">
                        <Badge variant="outline" className="font-mono mb-1">{s.status}</Badge>
                        <p className="text-xs text-muted-foreground">{s.descricao}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Storage Buckets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Storage Buckets
            </CardTitle>
            <CardDescription>Buckets de armazenamento de arquivos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {storageBucketsInfo.map((bucket) => (
                <div key={bucket.name} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{bucket.name}</p>
                      <p className="text-sm text-muted-foreground">{bucket.description}</p>
                    </div>
                  </div>
                  <Badge variant={bucket.public ? "secondary" : "outline"}>
                    {bucket.public ? "Público" : "Privado"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <Card className="print-break">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Menu className="w-5 h-5" />
              Funcionalidades do Sistema (Menu)
            </CardTitle>
            <CardDescription>Descrição de cada item do menu e tabelas utilizadas</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] print:h-auto">
              <div className="space-y-3">
                {menuInfoData.map((menu) => (
                  <div key={menu.path} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{menu.name}</span>
                        <Badge variant="outline" className="font-mono text-xs">{menu.path}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{menu.description}</p>
                    {menu.tables && menu.tables.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {menu.tables.map((table) => (
                          <Badge key={table} variant="secondary" className="text-xs font-mono">
                            {table}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Database Tables */}
        <Card className="print-break">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="w-5 h-5" />
              Tabelas do Banco de Dados
            </CardTitle>
            <CardDescription>Estrutura principal das tabelas PostgreSQL</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] print:h-auto">
              <Accordion type="multiple" className="w-full">
                {tableInfoData.map((table) => (
                  <AccordionItem key={table.name} value={table.name}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Table className="w-4 h-4" />
                        <span className="font-mono">{table.name}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-6 space-y-2">
                        <p className="text-sm text-muted-foreground">{table.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {table.columns.map((col) => (
                            <Badge key={col} variant="outline" className="text-xs font-mono">
                              {col}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Footer for PDF */}
        <div className="hidden print:block mt-8 pt-4 border-t">
          <p className="text-sm text-muted-foreground text-center">
            Este documento foi gerado automaticamente pelo sistema JurisControl para fins de registro em cartório.
          </p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            © {new Date().getFullYear()} Paixão Cortes Advogados - Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
