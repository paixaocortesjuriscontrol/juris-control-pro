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
  Lock,
  Globe,
  HardDrive,
  BookOpen,
  Users,
  Gavel,
  CalendarDays,
  BarChart3,
  FolderOpen,
  Bell,
  Bot,
  Upload,
  ClipboardList,
  Eye,
  Layers,
  Workflow,
  Cpu,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";

// ===================== TYPES =====================

interface SystemInfo {
  category: string;
  icon: React.ReactNode;
  description?: string;
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
  icon: React.ReactNode;
  description: string;
  tables?: string[];
  category: string;
}

interface TableInfo {
  name: string;
  description: string;
  columns: string[];
  category: string;
}

// ===================== DATA =====================

const SYSTEM_VERSION = "3.8.0";
const SYSTEM_BUILD_DATE = "Março 2026";

const systemInfoData: SystemInfo[] = [
  {
    category: "Frontend — Aplicação Web",
    icon: <Globe className="w-5 h-5" />,
    description: "Single-Page Application (SPA) moderna com renderização no cliente e comunicação via APIs REST/WebSocket.",
    items: [
      { name: "React", description: "Biblioteca para construção de interfaces reativas e componentizadas.", value: "v18.3.1", badge: "Core", badgeVariant: "default" },
      { name: "TypeScript", description: "Superset do JavaScript com tipagem estática para segurança e manutenibilidade.", value: "v5.x", badge: "Linguagem", badgeVariant: "secondary" },
      { name: "Vite", description: "Bundler de última geração com Hot Module Replacement (HMR) instantâneo.", value: "v5.x", badge: "Build", badgeVariant: "secondary" },
      { name: "Tailwind CSS", description: "Framework CSS utilitário para estilização consistente e responsiva.", value: "v3.x", badge: "Estilos", badgeVariant: "secondary" },
      { name: "shadcn/ui + Radix UI", description: "Componentes acessíveis (WAI-ARIA) com design system personalizável.", badge: "UI", badgeVariant: "secondary" },
      { name: "React Router DOM", description: "Roteamento declarativo para navegação entre páginas.", value: "v6.30", badge: "Navegação", badgeVariant: "outline" },
      { name: "TanStack Query", description: "Cache inteligente e gerenciamento de estado assíncrono (server state).", value: "v5.83", badge: "Data", badgeVariant: "outline" },
      { name: "Recharts", description: "Gráficos SVG interativos para dashboards e relatórios.", value: "v2.15", badge: "Gráficos", badgeVariant: "outline" },
      { name: "React Hook Form + Zod", description: "Formulários performáticos com validação de schema em runtime.", badge: "Formulários", badgeVariant: "outline" },
      { name: "date-fns / date-fns-tz", description: "Manipulação de datas com suporte a fusos horários (BRT).", value: "v3.6", badge: "Utilitário", badgeVariant: "outline" },
      { name: "Framer Motion", description: "Animações fluidas e transições de página.", badge: "Animação", badgeVariant: "outline" },
      { name: "jsPDF / html2canvas / docx", description: "Geração de relatórios em PDF e documentos Word no cliente.", badge: "Exportação", badgeVariant: "outline" },
      { name: "xlsx", description: "Leitura e escrita de planilhas Excel para importação/exportação em lote.", value: "v0.18.5", badge: "Importação", badgeVariant: "outline" },
      { name: "pdfjs-dist", description: "Renderização e extração de texto de PDFs no navegador.", value: "v4.10", badge: "PDF", badgeVariant: "outline" },
      { name: "DOMPurify", description: "Sanitização de HTML para prevenção de ataques XSS.", badge: "Segurança", badgeVariant: "destructive" },
    ],
  },
  {
    category: "Backend — Supabase Platform",
    icon: <Database className="w-5 h-5" />,
    description: "Backend-as-a-Service (BaaS) open source com PostgreSQL gerenciado, autenticação e Edge Functions.",
    items: [
      { name: "Supabase", description: "Plataforma BaaS que fornece banco, auth, storage, realtime e edge functions em uma solução integrada.", badge: "Infraestrutura", badgeVariant: "default" },
      { name: "PostgreSQL 15", description: "Banco de dados relacional ACID com Full-Text Search (tsvector), JSON, triggers e funções PL/pgSQL.", badge: "Banco de Dados", badgeVariant: "default" },
      { name: "Row Level Security (RLS)", description: "Políticas de segurança a nível de linha que garantem isolamento de dados por usuário/role.", badge: "Segurança", badgeVariant: "destructive" },
      { name: "Edge Functions (Deno)", description: "55+ funções serverless em TypeScript/Deno executando na borda com cold start < 100ms.", badge: "Serverless", badgeVariant: "secondary" },
      { name: "Supabase Auth", description: "Autenticação JWT com suporte a email/senha, magic link e recuperação de senha.", badge: "Auth", badgeVariant: "secondary" },
      { name: "Supabase Storage", description: "Armazenamento de arquivos com CDN, políticas de acesso e upload resumível (tus).", badge: "Storage", badgeVariant: "secondary" },
      { name: "Supabase Realtime", description: "Sincronização em tempo real via WebSockets para notificações e atualizações.", badge: "Realtime", badgeVariant: "outline" },
      { name: "Supabase Cron (pg_cron)", description: "Agendamento de tarefas recorrentes para monitoramentos automáticos.", badge: "Cron", badgeVariant: "outline" },
    ],
  },
  {
    category: "Integrações Externas",
    icon: <Cloud className="w-5 h-5" />,
    description: "APIs de terceiros consumidas pelas Edge Functions para enriquecer funcionalidades do sistema.",
    items: [
      { name: "PJE Comunica (DJEN)", description: "API pública do CNJ para busca de publicações do Diário de Justiça Eletrônico Nacional. Principal fonte para monitoramento de intimações.", badge: "Fonte Jurídica", badgeVariant: "default" },
      { name: "DataJud / CNJ", description: "API pública do Conselho Nacional de Justiça para consulta de processos, movimentações, redistribuições e novas distribuições.", badge: "Fonte Jurídica", badgeVariant: "default" },
      { name: "MNI (Modelo Nacional de Interoperabilidade)", description: "Webservice SOAP para consulta detalhada de processos nos tribunais (dados completos, partes, movimentos).", badge: "Fonte Jurídica", badgeVariant: "default" },
      { name: "OpenAI (GPT-4o)", description: "IA generativa para resumo de publicações, detecção de audiências, análise de documentos e assistente jurídico inteligente.", badge: "IA", badgeVariant: "secondary" },
      { name: "Resend", description: "Serviço de emails transacionais para notificações de audiências, alertas de prazos, lembretes e convites.", badge: "Email", badgeVariant: "secondary" },
      { name: "Z-API (WhatsApp)", description: "Gateway para envio de mensagens WhatsApp — notificações instantâneas de audiências, prazos e alertas críticos.", badge: "WhatsApp", badgeVariant: "secondary" },
      { name: "Jina AI", description: "Extração inteligente de conteúdo de páginas web (web scraping) para backfill de publicações DJEN.", badge: "Web Scraping", badgeVariant: "outline" },
      { name: "Lovable", description: "Plataforma de desenvolvimento assistida por IA. Gerencia deploy contínuo, hosting e domínio customizado.", badge: "Plataforma", badgeVariant: "outline" },
    ],
  },
  {
    category: "Segurança e Compliance",
    icon: <Shield className="w-5 h-5" />,
    description: "Camadas de segurança implementadas para proteção de dados sensíveis e conformidade com LGPD.",
    items: [
      { name: "Autenticação JWT", description: "Tokens assinados com expiração de 1h e refresh automático. Sessões persistidas no localStorage.", badge: "Auth", badgeVariant: "default" },
      { name: "RBAC (Role-Based Access Control)", description: "6 perfis de acesso: admin, coordenador, advogado, estagiário, assistente, secretária. Roles em tabela separada para evitar escalação de privilégios.", badge: "Controle de Acesso", badgeVariant: "default" },
      { name: "Row Level Security (RLS)", description: "100% das tabelas protegidas com políticas que restringem acesso por usuário autenticado e role.", badge: "Dados", badgeVariant: "destructive" },
      { name: "Supabase Vault", description: "Gerenciamento seguro de secrets (API keys) — nunca expostas no código frontend.", badge: "Secrets", badgeVariant: "destructive" },
      { name: "CORS Restritivo", description: "Edge Functions aceitam requests apenas de origens autorizadas (domínio de produção e ambientes de desenvolvimento).", badge: "Rede", badgeVariant: "outline" },
      { name: "Sanitização de Inputs", description: "Validação server-side com Zod + sanitização de HTML com DOMPurify para prevenção de XSS e injection.", badge: "Input", badgeVariant: "outline" },
      { name: "Auditoria de Ações", description: "Log de login, criação/edição de tarefas e operações críticas na tabela auditoria_tarefas.", badge: "Auditoria", badgeVariant: "outline" },
    ],
  },
];

// Menu items organized by category
const menuInfoData: MenuInfo[] = [
  // --- Visão Geral ---
  { name: "Dashboard", path: "/", icon: <BarChart3 className="w-4 h-4" />, description: "Painel principal com KPIs do escritório: total de processos, ativos, distribuídos, tarefas urgentes. Gráficos de distribuição por coordenação, status e área.", tables: ["processos", "tarefas", "coordenacoes", "profiles"], category: "Visão Geral" },
  { name: "Minha Agenda", path: "/minha-agenda", icon: <CalendarDays className="w-4 h-4" />, description: "Agenda pessoal com eventos, reuniões e audiências. Suporte a alertas automáticos via email e WhatsApp, recorrência de eventos e compartilhamento com participantes.", tables: ["eventos_agenda", "participantes_evento", "alertas_evento", "parcelas_evento"], category: "Visão Geral" },
  { name: "Notificações", path: "/notificacoes", icon: <Bell className="w-4 h-4" />, description: "Central de notificações do sistema com alertas de prazos vencendo, audiências detectadas, redistribuições e atualizações de processos.", tables: ["notificacoes"], category: "Visão Geral" },

  // --- Processos ---
  { name: "Processos Internos", path: "/processos", icon: <Gavel className="w-4 h-4" />, description: "Base completa de processos com filtros avançados por coordenação, status, tribunal, cliente e advogado. Detalhes com movimentações, documentos, custas e depósitos recursais.", tables: ["processos", "movimentacoes", "documentos", "clientes", "custas_processuais", "depositos_recursais"], category: "Processos" },
  { name: "Buscar Processos", path: "/buscar", icon: <Search className="w-4 h-4" />, description: "Busca rápida de processos no banco de dados do sistema por número, parte, cliente ou qualquer campo.", tables: ["processos"], category: "Processos" },
  { name: "Consulta Externa", path: "/consulta-externa", icon: <Globe className="w-4 h-4" />, description: "Consulta de processos diretamente nos sistemas dos tribunais via API DataJud/CNJ com dados atualizados.", tables: [], category: "Processos" },
  { name: "Buscar PJE", path: "/buscar-pje", icon: <Search className="w-4 h-4" />, description: "Busca de publicações e comunicações no PJE Comunica por advogado (OAB), número de processo ou palavra-chave.", tables: [], category: "Processos" },
  { name: "Importar Processos", path: "/importar", icon: <Upload className="w-4 h-4" />, description: "Importação em lote de processos via planilha Excel (.xlsx). Suporta múltiplas abas, deduplicação automática e campos personalizados por coordenação.", tables: ["processos", "clientes"], category: "Processos" },
  { name: "Importar Tarefas", path: "/importar-tarefas", icon: <Upload className="w-4 h-4" />, description: "Importação de tarefas/prazos do sistema Projuris via planilha Excel com vinculação automática a processos existentes.", tables: ["tarefas", "processos"], category: "Processos" },

  // --- Tarefas e Prazos ---
  { name: "Minhas Tarefas", path: "/minha-carteira", icon: <ClipboardList className="w-4 h-4" />, description: "Kanban pessoal de tarefas com visualização por status (pendente, em andamento, concluída) e prioridade. Suporte a comentários e anexos.", tables: ["tarefas", "processos", "comentarios_tarefas"], category: "Tarefas" },
  { name: "Prazos", path: "/prazos", icon: <Clock className="w-4 h-4" />, description: "Calendário de prazos processuais com visualização mensal, filtros por coordenação/responsável e alertas de vencimento.", tables: ["tarefas", "processos"], category: "Tarefas" },
  { name: "Painel da Equipe", path: "/painel-equipe", icon: <Users className="w-4 h-4" />, description: "Visão consolidada das tarefas e prazos de toda a equipe por coordenação, permitindo redistribuição de trabalho.", tables: ["tarefas", "processos", "profiles", "coordenacoes"], category: "Tarefas" },

  // --- DJEN e Monitoramento ---
  { name: "Análise DJEN", path: "/analise-djen", icon: <Newspaper className="w-4 h-4" />, description: "Análise de publicações do DJEN com resumo automático via IA (OpenAI GPT-4o). Triagem por prioridade, detecção de audiências e vinculação a processos.", tables: ["publicacoes_djen", "publicacoes_djen_processos", "audiencias_detectadas"], category: "DJEN" },
  { name: "Buscar DJEN", path: "/buscar-djen", icon: <Search className="w-4 h-4" />, description: "Busca manual de publicações no DJEN por termo, OAB, número de processo ou nome de parte.", tables: ["publicacoes_djen"], category: "DJEN" },
  { name: "Monit. DJEN", path: "/monitoramento-djen", icon: <Eye className="w-4 h-4" />, description: "Configuração de monitoramentos automáticos do DJEN por termo de busca, OAB ou cliente. Execução diária com escalonamento por tribunal.", tables: ["monitoramentos_djen", "publicacoes_djen", "audiencias_detectadas"], category: "DJEN" },
  { name: "Painel Audiências", path: "/painel-audiencias", icon: <Gavel className="w-4 h-4" />, description: "Gestão de audiências detectadas via monitoramento ou cadastradas manualmente. Atribuição de advogados, prepostos e configuração de lembretes.", tables: ["audiencias_detectadas", "audiencias_advogados", "alertas_audiencias", "lembretes_audiencia"], category: "DJEN" },

  // --- Monitoramentos Avançados ---
  { name: "Redistribuições", path: "/redistribuicoes", icon: <ArrowRightLeft className="w-4 h-4" />, description: "Detecção automática de redistribuições de processos entre varas nos tribunais, com notificações ao responsável.", tables: ["processos", "movimentacoes", "notificacoes"], category: "Monitoramentos" },
  { name: "Monit. Distribuição", path: "/monitoramento-distribuicao", icon: <Search className="w-4 h-4" />, description: "Monitoramento de novas distribuições nos tribunais por nome de parte, CPF/CNPJ ou OAB do advogado.", tables: ["monitoramentos_distribuicao", "distribuicoes_encontradas"], category: "Monitoramentos" },
  { name: "Monitoração 360°", path: "/monitoramento-360", icon: <Target className="w-4 h-4" />, description: "Painel consolidado de monitoramentos com termos customizados, carteiras de processos e alertas por email.", tables: ["carteiras_processos", "termos_monitoramento", "alertas_monitoramento"], category: "Monitoramentos" },

  // --- Coordenações e Equipe ---
  { name: "Coordenações", path: "/coordenacoes", icon: <Layers className="w-4 h-4" />, description: "Gestão das coordenações do escritório com membros, processos vinculados e configurações de monitoramento DJEN por coordenação.", tables: ["coordenacoes", "membros_coordenacao", "processos"], category: "Equipe" },
  { name: "Clientes", path: "/clientes", icon: <Users className="w-4 h-4" />, description: "Cadastro e gestão de clientes (PF/PJ) com agrupamento, histórico de processos e portal do cliente via convite.", tables: ["clientes", "grupos_clientes", "clientes_grupos", "convites_cliente"], category: "Equipe" },

  // --- Documentos ---
  { name: "Pastas", path: "/pastas", icon: <FolderOpen className="w-4 h-4" />, description: "Organização de processos em pastas por cliente ou coordenação com upload de documentos e categorização.", tables: ["pastas", "documentos", "processos"], category: "Documentos" },
  { name: "Documentos", path: "/documentos", icon: <FileText className="w-4 h-4" />, description: "Repositório de documentos vinculados a processos com busca full-text no conteúdo extraído.", tables: ["documentos", "documentos_texto_indexado"], category: "Documentos" },
  { name: "Repositório IA", path: "/repositorio", icon: <Bot className="w-4 h-4" />, description: "Repositório inteligente de documentos com análise via IA, extração de texto, classificação automática e chat contextual.", tables: ["documentos"], category: "Documentos" },

  // --- IA e Relatórios ---
  { name: "Assistente IA", path: "/assistente-juridico", icon: <Bot className="w-4 h-4" />, description: "Chat com assistente jurídico baseado em GPT-4o para consultas, análise de peças e orientação processual.", tables: [], category: "Inteligência Artificial" },
  { name: "Relatórios", path: "/relatorios", icon: <BarChart3 className="w-4 h-4" />, description: "Relatórios gerenciais com gráficos interativos (Recharts) — distribuição por coordenação, status, prazos vencidos, produtividade. Exportação em PDF.", tables: ["processos", "tarefas", "movimentacoes", "clientes"], category: "Relatórios" },

  // --- Administração ---
  { name: "Administração", path: "/admin", icon: <Shield className="w-4 h-4" />, description: "Gestão de usuários, perfis de acesso (RBAC), histórico de login, documentação técnica e configurações do sistema.", tables: ["profiles", "user_roles", "historico_login", "auditoria_tarefas"], category: "Sistema" },
  { name: "Configurações", path: "/configuracoes", icon: <Cpu className="w-4 h-4" />, description: "Configurações de monitoramentos, frequência de execução, horários agendados e parâmetros de integração.", tables: ["configuracoes_monitoramento", "parametros_monitoramento_djen"], category: "Sistema" },
];

const tableInfoData: TableInfo[] = [
  // Core
  { name: "processos", description: "Processos judiciais do escritório com dados completos do CNJ.", columns: ["id", "numero", "area", "status", "polo_ativo", "polo_passivo", "tribunal", "vara", "comarca", "valor_causa", "cliente_id", "coordenacao_id", "advogado_responsavel_id"], category: "Core" },
  { name: "profiles", description: "Perfis de usuários com dados pessoais e profissionais.", columns: ["id", "nome", "email", "oab", "telefone", "filial", "avatar_url", "ativo"], category: "Core" },
  { name: "user_roles", description: "Roles de acesso dos usuários (tabela separada por segurança).", columns: ["id", "user_id", "role"], category: "Core" },
  { name: "coordenacoes", description: "Coordenações/equipes do escritório.", columns: ["id", "nome", "descricao", "area", "coordenador_id", "monitorar_distribuicoes", "monitorar_redistribuicoes"], category: "Core" },
  { name: "membros_coordenacao", description: "Membros vinculados a cada coordenação.", columns: ["id", "coordenacao_id", "usuario_id", "cargo"], category: "Core" },
  { name: "clientes", description: "Clientes do escritório (PF/PJ).", columns: ["id", "nome", "tipo", "cpf_cnpj", "email", "telefone", "endereco", "observacoes"], category: "Core" },

  // Tarefas
  { name: "tarefas", description: "Tarefas e prazos vinculados a processos.", columns: ["id", "titulo", "descricao", "processo_id", "responsavel_id", "status", "prioridade", "data_vencimento", "data_fatal"], category: "Tarefas" },
  { name: "comentarios_tarefas", description: "Comentários em tarefas.", columns: ["id", "tarefa_id", "autor_id", "conteudo"], category: "Tarefas" },
  { name: "auditoria_tarefas", description: "Log de auditoria de ações em tarefas.", columns: ["id", "acao", "tarefa_id", "usuario_id", "sucesso", "dados_entrada", "dados_saida"], category: "Tarefas" },

  // Movimentações
  { name: "movimentacoes", description: "Andamentos processuais importados dos tribunais.", columns: ["id", "processo_id", "descricao", "data_movimentacao", "tipo", "fonte"], category: "Movimentações" },

  // Documentos
  { name: "documentos", description: "Documentos anexados a processos ou tarefas.", columns: ["id", "nome", "url", "tipo", "tamanho_bytes", "processo_id", "pasta_id", "uploaded_by", "conteudo_extraido", "analisado_ia"], category: "Documentos" },
  { name: "documentos_texto_indexado", description: "Texto extraído de PDFs para busca full-text.", columns: ["id", "documento_id", "processo_id", "pagina", "conteudo_texto"], category: "Documentos" },
  { name: "pastas", description: "Pastas para organização de processos e documentos.", columns: ["id", "nome", "descricao", "cliente_id", "coordenacao_id", "status", "criado_por"], category: "Documentos" },

  // Agenda
  { name: "eventos_agenda", description: "Eventos da agenda (reuniões, audiências, compromissos).", columns: ["id", "titulo", "descricao", "tipo", "data_inicio", "data_fim", "local", "criado_por", "recorrente"], category: "Agenda" },
  { name: "participantes_evento", description: "Participantes vinculados a eventos.", columns: ["id", "evento_id", "usuario_id", "notificar"], category: "Agenda" },
  { name: "alertas_evento", description: "Alertas agendados para eventos.", columns: ["id", "evento_id", "minutos_antes", "enviado"], category: "Agenda" },
  { name: "parcelas_evento", description: "Parcelas financeiras vinculadas a eventos.", columns: ["id", "evento_id", "valor", "data_vencimento", "status"], category: "Agenda" },

  // DJEN
  { name: "monitoramentos_djen", description: "Configurações de monitoramento do DJEN.", columns: ["id", "termo_busca", "tipo", "uf", "tribunais", "oab", "ativo", "coordenacao_id"], category: "DJEN" },
  { name: "publicacoes_djen", description: "Publicações encontradas no DJEN.", columns: ["id", "caderno", "data_publicacao", "conteudo", "resumo_ia", "monitoramento_id", "hash_conteudo"], category: "DJEN" },
  { name: "publicacoes_djen_processos", description: "Vinculação de publicações DJEN a processos.", columns: ["id", "publicacao_id", "processo_id", "processo_numero"], category: "DJEN" },
  { name: "audiencias_detectadas", description: "Audiências detectadas via IA nas publicações do DJEN.", columns: ["id", "processo_numero", "data_audiencia", "hora", "tipo_audiencia", "local_audiencia", "status", "advogado"], category: "DJEN" },

  // Monitoramentos
  { name: "configuracoes_monitoramento", description: "Configuração central de cada tipo de monitoramento.", columns: ["id", "tipo", "ativo", "frequencia", "horarios_execucao", "metadata", "ultima_execucao"], category: "Monitoramentos" },
  { name: "monitoramentos_distribuicao", description: "Monitoramentos de novas distribuições por parte/OAB.", columns: ["id", "termo", "tipo_termo", "tribunais", "ativo", "coordenacao_id"], category: "Monitoramentos" },
  { name: "distribuicoes_encontradas", description: "Processos encontrados pelo monitoramento de distribuição.", columns: ["id", "monitoramento_id", "numero_processo", "polo_ativo", "polo_passivo", "tribunal", "status"], category: "Monitoramentos" },
  { name: "termos_monitoramento", description: "Termos configurados na Monitoração 360°.", columns: ["id", "termo", "tipo", "prioridade", "ativo"], category: "Monitoramentos" },
  { name: "alertas_monitoramento", description: "Alertas gerados pelo monitoramento de termos.", columns: ["id", "processo_id", "termo_id", "termo_encontrado", "prioridade", "status"], category: "Monitoramentos" },
  { name: "carteiras_processos", description: "Carteiras para agrupamento de processos monitorados.", columns: ["id", "nome", "descricao", "tipo", "criado_por", "criterios"], category: "Monitoramentos" },

  // Financeiro
  { name: "custas_processuais", description: "Custas processuais pagas.", columns: ["id", "processo_id", "descricao", "valor", "data_pagamento"], category: "Financeiro" },
  { name: "depositos_recursais", description: "Depósitos recursais realizados.", columns: ["id", "processo_id", "titulo", "valor", "data_pagamento"], category: "Financeiro" },

  // Notificações
  { name: "notificacoes", description: "Notificações internas do sistema.", columns: ["id", "usuario_id", "titulo", "mensagem", "tipo", "link", "lida", "dados"], category: "Notificações" },
  { name: "historico_login", description: "Log de acessos ao sistema.", columns: ["id", "user_id", "email", "ip_address", "user_agent", "logged_in_at"], category: "Notificações" },

  // DJEN Indexação
  { name: "djen_diario_publicacoes", description: "Publicações indexadas do DJEN por dia com full-text search (tsvector).", columns: ["id", "diario_ymd", "tribunal", "conteudo", "conteudo_tsv", "processo_numero", "hash_global"], category: "DJEN Indexação" },
  { name: "djen_diario_index", description: "Índice de diários processados por data.", columns: ["id", "diario_ymd", "status", "total_publicacoes", "total_tribunais"], category: "DJEN Indexação" },
  { name: "djen_runs", description: "Registros de execuções do engine DJEN.", columns: ["id", "run_id", "status", "novas", "duplicatas", "erros", "duracao_segundos"], category: "DJEN Indexação" },
];

const secretsInfo = [
  { name: "SUPABASE_URL", description: "URL do projeto Supabase.", category: "Supabase", isPublic: true },
  { name: "SUPABASE_ANON_KEY", description: "Chave anônima (pública) com RLS ativo. Segura para frontend.", category: "Supabase", isPublic: true },
  { name: "SUPABASE_SERVICE_ROLE_KEY", description: "Chave de serviço com bypass de RLS. Exclusiva para Edge Functions.", category: "Supabase", isPublic: false },
  { name: "RESEND_API_KEY", description: "Chave do Resend para envio de emails transacionais.", category: "Email", isPublic: false },
  { name: "OPENAI_API_KEY", description: "Chave da OpenAI (GPT-4o) para resumos, análises e assistente jurídico.", category: "IA", isPublic: false },
  { name: "JINA_API_KEY", description: "Chave do Jina AI para extração de conteúdo web (web scraping).", category: "IA", isPublic: false },
  { name: "ZAPI_INSTANCE_ID", description: "ID da instância Z-API para integração WhatsApp.", category: "WhatsApp", isPublic: false },
  { name: "ZAPI_TOKEN", description: "Token de autenticação Z-API para envio de mensagens.", category: "WhatsApp", isPublic: false },
  { name: "ZAPI_CLIENT_TOKEN", description: "Token do cliente Z-API para webhooks.", category: "WhatsApp", isPublic: false },
];

const edgeFunctionsInfo = [
  // DJEN & Publicações
  { name: "buscar-djen", description: "Busca publicações no DJEN por termo, OAB ou número de processo.", category: "DJEN" },
  { name: "monitorar-djen", description: "Monitora publicações DJEN por monitoramento configurado.", category: "DJEN" },
  { name: "monitorar-djen-processos", description: "Monitora publicações DJEN para processos cadastrados.", category: "DJEN" },
  { name: "monitorar-djen-trigger", description: "Trigger de monitoramento DJEN para execução sob demanda.", category: "DJEN" },
  { name: "resumir-publicacoes", description: "Resume publicações DJEN usando GPT-4o.", category: "DJEN" },
  { name: "analisar-publicacao-ia", description: "Analisa publicações com IA para detecção de audiências e prazos.", category: "DJEN" },
  { name: "analisar-tst-ia", description: "Análise especializada de publicações do TST via IA.", category: "DJEN" },
  { name: "backfill-djen", description: "Reprocessa publicações DJEN de períodos anteriores.", category: "DJEN" },
  { name: "backfill-djen-jina", description: "Extração de conteúdo via Jina AI para backfill.", category: "DJEN" },
  { name: "backfill-djen-job", description: "Gerencia jobs de backfill do DJEN.", category: "DJEN" },
  { name: "limpar-djen-hoje", description: "Limpa publicações DJEN do dia para reprocessamento.", category: "DJEN" },
  { name: "indexar-djen-diario", description: "Indexa publicações DJEN por dia com full-text search.", category: "DJEN" },
  { name: "cancelar-indexacao-djen", description: "Cancela indexação DJEN em andamento.", category: "DJEN" },
  { name: "buscar-dje-interno", description: "Busca no índice interno de publicações DJEN.", category: "DJEN" },

  // DJE PDF
  { name: "baixar-dje-pdf", description: "Baixa PDFs do DJE para processamento.", category: "DJE" },
  { name: "processar-dje-pdf", description: "Processa PDFs do DJE extraindo texto e metadados.", category: "DJE" },

  // Processos e Consultas
  { name: "consultar-processo", description: "Consulta processos via API DataJud/CNJ.", category: "Processos" },
  { name: "consultar-processo-mni", description: "Consulta processos via MNI (Webservice SOAP) dos tribunais.", category: "Processos" },
  { name: "buscar-eprocesso", description: "Busca processos no e-Processo/e-SAJ.", category: "Processos" },
  { name: "buscar-pje", description: "Busca comunicações no PJE Comunica.", category: "Processos" },
  { name: "capturar-processo-tribunal", description: "Captura dados completos de processo direto do tribunal.", category: "Processos" },
  { name: "baixar-autos-pje", description: "Baixa autos processuais do PJE.", category: "Processos" },
  { name: "capturar-intimacoes", description: "Captura intimações pendentes do PJE.", category: "Processos" },

  // Monitoramentos
  { name: "executar-monitoramento", description: "Orquestrador central de todos os monitoramentos.", category: "Monitoramentos" },
  { name: "monitorar-andamentos", description: "Monitora novos andamentos via DataJud.", category: "Monitoramentos" },
  { name: "monitorar-redistribuicoes", description: "Detecta redistribuições de processos.", category: "Monitoramentos" },
  { name: "monitorar-distribuicoes", description: "Monitora novas distribuições nos tribunais.", category: "Monitoramentos" },
  { name: "monitorar-termos", description: "Monitora termos da Monitoração 360°.", category: "Monitoramentos" },
  { name: "monitorar-datajud-termos", description: "Monitora termos específicos na base DataJud.", category: "Monitoramentos" },
  { name: "monitorar-pje", description: "Monitora processos no PJE.", category: "Monitoramentos" },
  { name: "atualizar-cron-monitoramento", description: "Atualiza configurações de cron jobs.", category: "Monitoramentos" },

  // Notificações e Alertas
  { name: "alertar-audiencias", description: "Processa e envia alertas de audiências próximas.", category: "Alertas" },
  { name: "processar-alertas-evento", description: "Processa alertas agendados de eventos.", category: "Alertas" },
  { name: "processar-alertas-parcela", description: "Processa alertas de parcelas financeiras.", category: "Alertas" },
  { name: "processar-lembretes-audiencia", description: "Processa lembretes de audiências detectadas.", category: "Alertas" },
  { name: "processar-alertas-djen-coordenacao", description: "Processa alertas DJEN por coordenação.", category: "Alertas" },
  { name: "processar-tarefas-vencendo", description: "Alerta sobre tarefas próximas do vencimento.", category: "Alertas" },
  { name: "notificar-evento", description: "Envia notificações de eventos via Resend.", category: "Alertas" },
  { name: "notificar-tarefa-criada", description: "Notifica responsável quando tarefa é criada.", category: "Alertas" },
  { name: "enviar-alertas-360-email", description: "Envia alertas da Monitoração 360° por email.", category: "Alertas" },
  { name: "enviar-alerta-coordenacao", description: "Envia alertas específicos por coordenação.", category: "Alertas" },
  { name: "enviar-resumo-monitoramento", description: "Envia resumo diário dos monitoramentos por email.", category: "Alertas" },
  { name: "enviar-whatsapp-zapi", description: "Envia mensagens WhatsApp via Z-API.", category: "Alertas" },

  // Usuários e Admin
  { name: "cadastrar-perfil", description: "Cadastro de perfis de usuários.", category: "Admin" },
  { name: "cadastrar-perfis-lote", description: "Cadastro em lote de perfis.", category: "Admin" },
  { name: "cadastrar-equipe", description: "Cadastro de membros em coordenações.", category: "Admin" },
  { name: "atualizar-usuario", description: "Atualiza dados de usuários com permissões elevadas.", category: "Admin" },
  { name: "cofre-senhas", description: "Gerenciamento seguro de credenciais de sistemas externos.", category: "Admin" },
  { name: "enviar-convite-cliente", description: "Envia convite de acesso ao portal do cliente.", category: "Admin" },
  { name: "aceitar-convite-cliente", description: "Processa aceitação de convite pelo cliente.", category: "Admin" },

  // IA
  { name: "analisar-documento", description: "Analisa documentos jurídicos com IA para extração de informações.", category: "IA" },
  { name: "repositorio-chat", description: "Chat contextual com documentos do repositório via GPT-4o.", category: "IA" },
];

// ===================== MONITORING DATA =====================

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
    descricao: "Detecta automaticamente quando um processo é redistribuído para outra vara ou juízo nos tribunais.",
    fontesDados: ["API DataJud/CNJ"],
    tabelasEnvolvidas: ["processos", "movimentacoes", "notificacoes", "configuracoes_monitoramento"],
    edgeFunctions: ["monitorar-redistribuicoes", "executar-monitoramento"],
    frequenciaPadrao: "Diário",
    horarioAgendado: "00:30 BRT",
    comoFunciona: [
      "Consulta todos os processos ativos no banco de dados",
      "Para cada processo, busca dados atualizados na API DataJud",
      "Compara a vara atual com a retornada pela API",
      "Se houver diferença, registra movimentação de redistribuição",
      "Cria notificação para o advogado responsável",
      "Atualiza dados do processo automaticamente",
    ],
    oQueEncontra: ["Mudanças de vara/juízo", "Mudanças de competência", "Redistribuições por prevenção"],
    limitacoes: ["Depende de processos já cadastrados", "API do CNJ pode ter atraso de horas/dias", "Não detecta redistribuições em processos não cadastrados"],
    badge: "DataJud",
    badgeVariant: "default",
  },
  {
    id: "andamentos",
    nome: "Andamentos",
    icon: <Activity className="w-5 h-5" />,
    descricao: "Monitora novos andamentos processuais nos tribunais para processos já cadastrados.",
    fontesDados: ["API DataJud/CNJ"],
    tabelasEnvolvidas: ["processos", "movimentacoes", "notificacoes", "configuracoes_monitoramento"],
    edgeFunctions: ["monitorar-andamentos", "executar-monitoramento"],
    frequenciaPadrao: "Diário",
    horarioAgendado: "23:00 BRT",
    comoFunciona: [
      "Consulta processos com monitoramento de andamentos ativo",
      "Busca últimos movimentos na API DataJud",
      "Compara com movimentações já registradas (deduplicação por hash)",
      "Insere apenas movimentações novas",
      "Pode gerar tarefas automáticas para movimentações importantes",
    ],
    oQueEncontra: ["Despachos e decisões", "Intimações publicadas", "Sentenças e acórdãos", "Qualquer movimentação registrada no tribunal"],
    limitacoes: ["Restrito a processos com monitoramento ativo", "Depende da atualização do tribunal na base do CNJ"],
    badge: "DataJud",
    badgeVariant: "default",
  },
  {
    id: "distribuicoes",
    nome: "Distribuições",
    icon: <Search className="w-5 h-5" />,
    descricao: "Busca novas distribuições nos tribunais por nome, CPF/CNPJ ou OAB.",
    fontesDados: ["API DataJud/CNJ (Elasticsearch)"],
    tabelasEnvolvidas: ["monitoramentos_distribuicao", "distribuicoes_encontradas", "processos", "notificacoes"],
    edgeFunctions: ["monitorar-distribuicoes", "executar-monitoramento"],
    frequenciaPadrao: "Diário",
    horarioAgendado: "03:30 BRT",
    comoFunciona: [
      "Lê monitoramentos ativos da tabela monitoramentos_distribuicao",
      "Monta query Elasticsearch na API DataJud",
      "Busca processos distribuídos nos últimos 30 dias",
      "Verifica deduplicação contra processos já existentes",
      "Salva em distribuicoes_encontradas com status 'pendente'",
      "Usuário pode importar ou ignorar cada resultado",
    ],
    oQueEncontra: ["Novas ações contra clientes monitorados", "Processos onde advogado (OAB) está cadastrado", "Novos processos por nome de parte"],
    limitacoes: ["Depende de configurar termos manualmente", "Janela de 30 dias", "Termos genéricos geram falsos positivos"],
    badge: "DataJud",
    badgeVariant: "secondary",
  },
  {
    id: "djen",
    nome: "DJEN Publicações",
    icon: <Newspaper className="w-5 h-5" />,
    descricao: "Monitora o Diário de Justiça Eletrônico Nacional buscando publicações por termos configurados (OAB, nome, palavra-chave).",
    fontesDados: ["PJE Comunica (API CNJ)"],
    tabelasEnvolvidas: ["monitoramentos_djen", "publicacoes_djen", "audiencias_detectadas", "notificacoes"],
    edgeFunctions: ["monitorar-djen", "resumir-publicacoes", "analisar-publicacao-ia"],
    frequenciaPadrao: "Diário",
    horarioAgendado: "05:00 BRT",
    comoFunciona: [
      "Lê monitoramentos ativos com termos de busca e tribunais configurados",
      "Busca na API PJE Comunica paginando todos os resultados",
      "Deduplicação por hash do conteúdo para evitar duplicatas",
      "Salva publicações novas na tabela publicacoes_djen",
      "Analisa conteúdo com GPT-4o para detectar audiências",
      "Gera notificações e alertas por coordenação",
    ],
    oQueEncontra: ["Intimações de audiências", "Publicações de despachos e decisões", "Sentenças e acórdãos", "Citações e notificações"],
    limitacoes: ["Depende do PJE Comunica estar disponível", "Análise de IA pode ter falsos positivos na detecção de audiências", "Publicações muito longas podem ser truncadas"],
    badge: "PJE Comunica",
    badgeVariant: "default",
  },
  {
    id: "djen_processos",
    nome: "DJEN por Processos",
    icon: <FileText className="w-5 h-5" />,
    descricao: "Busca publicações DJEN especificamente para números de processos cadastrados (busca global sem filtro de tribunal).",
    fontesDados: ["PJE Comunica (API CNJ)"],
    tabelasEnvolvidas: ["processos", "publicacoes_djen_processos", "notificacoes", "configuracoes_monitoramento"],
    edgeFunctions: ["monitorar-djen-processos", "executar-monitoramento"],
    frequenciaPadrao: "Diário",
    horarioAgendado: "02:00 BRT",
    comoFunciona: [
      "Consulta todos os processos ativos cadastrados no sistema",
      "Realiza busca global única por processo (sem filtro de tribunal — otimização 140x)",
      "Executa em paralelo com 8 workers simultâneos e delay de 1s entre batches",
      "Valida que os dígitos da publicação correspondem exatamente ao processo buscado",
      "Vincula publicações encontradas ao processo correspondente",
    ],
    oQueEncontra: ["Publicações específicas de cada processo", "Intimações direcionadas", "Despachos e decisões do processo"],
    limitacoes: ["Depende do número estar correto no formato CNJ", "Processos sigilosos podem não aparecer no PJE Comunica"],
    badge: "PJE Comunica",
    badgeVariant: "secondary",
  },
  {
    id: "termos_360",
    nome: "Termos 360°",
    icon: <Target className="w-5 h-5" />,
    descricao: "Monitoramento abrangente que analisa dados internos buscando por termos e padrões configurados.",
    fontesDados: ["Banco de dados interno (PostgreSQL)"],
    tabelasEnvolvidas: ["termos_monitoramento", "carteiras_processos", "alertas_monitoramento", "processos", "movimentacoes"],
    edgeFunctions: ["monitorar-termos", "enviar-alertas-360-email", "executar-monitoramento"],
    frequenciaPadrao: "Diário",
    horarioAgendado: "06:00 BRT",
    comoFunciona: [
      "Lê termos configurados na Monitoração 360",
      "Analisa movimentações recentes buscando correspondências",
      "Verifica processos em carteiras específicas",
      "Gera alertas com prioridade baseada na configuração",
      "Envia resumo por email para gestores",
    ],
    oQueEncontra: ["Padrões de movimentação (ex: 'sentença', 'arquivamento')", "Processos em situações específicas", "Alertas customizados por regras do escritório"],
    limitacoes: ["Analisa apenas dados já presentes no sistema", "Não busca em fontes externas", "Depende da qualidade dos termos configurados"],
    badge: "Interno",
    badgeVariant: "outline",
  },
];

const arquiteturaExecucaoInfo = {
  orquestrador: {
    nome: "executar-monitoramento",
    funcionalidades: [
      "Serializa tarefas pesadas para evitar sobrecarga (WORKER_LIMIT do Supabase)",
      "Gerencia paginação e continuação entre batches",
      "Detecta heartbeat e marca execuções travadas como timeout (5min sem atividade)",
      "Reseta flags de cancelamento ao iniciar nova execução",
      "Dispara workers em background para tarefas longas",
      "Registra métricas de execução (duração, processados, erros)",
    ],
  },
  tabelasControle: [
    { nome: "configuracoes_monitoramento", descricao: "Configuração central de cada monitoramento", campos: ["tipo", "frequencia", "ativo", "horarios_execucao", "metadata", "ultima_execucao"] },
    { nome: "execucoes_agendadas", descricao: "Registro de cada execução com status e progresso", campos: ["tipo", "status", "iniciado_em", "finalizado_em", "registros_processados"] },
    { nome: "historico_monitoramento", descricao: "Log histórico para auditoria e relatórios", campos: ["tipo", "data_execucao", "processos_verificados", "novos_andamentos", "erros"] },
  ],
  statusPossiveis: [
    { status: "idle", descricao: "Aguardando próxima execução", color: "text-muted-foreground" },
    { status: "executando", descricao: "Em execução no momento", color: "text-blue-500" },
    { status: "concluido", descricao: "Última execução OK", color: "text-green-500" },
    { status: "erro", descricao: "Última execução falhou", color: "text-destructive" },
    { status: "cancelado", descricao: "Cancelada manualmente", color: "text-orange-500" },
    { status: "timeout", descricao: "Excedeu tempo limite", color: "text-destructive" },
  ],
  horariosAgendados: [
    { tipo: "Andamentos", horario: "23:00", descricao: "Movimentações do dia nos tribunais" },
    { tipo: "Redistribuições", horario: "00:30", descricao: "Detecção de mudanças de vara" },
    { tipo: "DJEN Processos", horario: "02:00", descricao: "Publicações de processos cadastrados" },
    { tipo: "Distribuições", horario: "03:30", descricao: "Novas distribuições por parte/OAB" },
    { tipo: "DJEN Publicações", horario: "05:00", descricao: "Publicações por termos monitorados" },
    { tipo: "Termos 360°", horario: "06:00", descricao: "Análise interna de termos" },
    { tipo: "Tarefas Vencendo", horario: "07:00", descricao: "Alertas de prazos próximos" },
  ],
};

const storageBucketsInfo = [
  { name: "projuris_planilhas", description: "Planilhas importadas do Projuris e processos.", public: true },
  { name: "equipe", description: "Fotos de perfil e arquivos da equipe.", public: true },
  { name: "documentos_processos", description: "Documentos anexados a processos.", public: true },
  { name: "repositorio_documentos", description: "Documentos do repositório com análise IA.", public: false },
];

// ===================== COMPONENT =====================

export function InfoSistemaTab() {
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = printRef.current;

      // Expand all Radix Accordion items before capture
      const closedTriggers = element.querySelectorAll('[data-state="closed"][role="button"], button[data-state="closed"][data-radix-collection-item]');
      const closedContents = element.querySelectorAll('[data-state="closed"][role="region"], [data-state="closed"][data-radix-accordion-content]');
      
      // Also expand via clicking triggers to properly open Radix accordions
      const allTriggers = Array.from(element.querySelectorAll('button[data-state="closed"]'));
      for (const trigger of allTriggers) {
        (trigger as HTMLElement).click();
      }
      
      // Wait for animations to complete
      await new Promise((resolve) => setTimeout(resolve, 800));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      // Collapse them back by clicking open triggers
      const openTriggers = Array.from(element.querySelectorAll('button[data-state="open"]'));
      for (const trigger of openTriggers) {
        (trigger as HTMLElement).click();
      }

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pdfWidth - margin * 2;
      const usableHeight = pdfHeight - margin * 2;

      // Slice the canvas into page-sized chunks
      const scaleFactor = usableWidth / canvas.width;
      const sliceHeightPx = Math.floor(usableHeight / scaleFactor);
      const totalPages = Math.ceil(canvas.height / sliceHeightPx);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        const srcY = page * sliceHeightPx;
        const srcH = Math.min(sliceHeightPx, canvas.height - srcY);

        // Create a sub-canvas for this page slice
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = srcH;
        const ctx = pageCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        }

        const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.92);
        const imgH = srcH * scaleFactor;
        pdf.addImage(pageImgData, "JPEG", margin, margin, usableWidth, imgH);
      }

      pdf.save(`JurisControl_Documentacao_v${SYSTEM_VERSION}.pdf`);
      toast.success("PDF exportado com sucesso!");
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
  });

  const menuCategories = [...new Set(menuInfoData.map((m) => m.category))];
  const tableCategories = [...new Set(tableInfoData.map((t) => t.category))];
  const edgeFunctionCategories = [...new Set(edgeFunctionsInfo.map((f) => f.category))];

  return (
    <div className="space-y-6">
      {/* ───── Header ───── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-xl shadow-primary/20">
            <BookOpen className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">Documentação do Sistema</h2>
              <Badge className="font-mono text-xs">v{SYSTEM_VERSION}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">Arquitetura técnica, integrações e funcionalidades — {currentDate}</p>
          </div>
        </div>
        <Button onClick={handleExportPdf} disabled={exporting} size="sm" className="gap-2">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Exportar PDF
        </Button>
      </div>

      {/* ───── Print Content ───── */}
      <div id="system-info-content" ref={printRef} className="space-y-6">

        {/* PDF Header (hidden on screen) */}
        <div className="hidden print:block mb-8 text-center">
          <h1 className="text-3xl font-bold">JurisControl — Documentação Técnica</h1>
          <p className="text-muted-foreground mt-1">Paixão Cortes Advogados</p>
          <p className="text-sm text-muted-foreground mt-1">Versão {SYSTEM_VERSION} • {SYSTEM_BUILD_DATE} • Gerado em {currentDate}</p>
          <Separator className="mt-4" />
        </div>

        {/* ───── 1. Informações Gerais ───── */}
        <Card className="border-none shadow-md bg-gradient-to-br from-card to-muted/30">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10"><Info className="w-4 h-4 text-primary" /></div>
              Informações Gerais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Sistema", value: "JurisControl", icon: <Server className="w-4 h-4" /> },
                { label: "Versão", value: `v${SYSTEM_VERSION}`, icon: <Code className="w-4 h-4" /> },
                { label: "Proprietário", value: "Paixão Cortes Advogados", icon: <Gavel className="w-4 h-4" /> },
                { label: "Domínio", value: "juriscontrol.adv.br", icon: <Globe className="w-4 h-4" /> },
                { label: "Hospedagem", value: "Lovable Cloud", icon: <Cloud className="w-4 h-4" /> },
                { label: "Backend", value: "Supabase (PostgreSQL)", icon: <Database className="w-4 h-4" /> },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-xl bg-background/80 border border-border/50">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    {item.icon}
                    <span className="text-xs font-medium uppercase tracking-wider">{item.label}</span>
                  </div>
                  <p className="font-semibold text-sm">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {[
                { label: "Edge Functions", value: edgeFunctionsInfo.length, color: "text-blue-500" },
                { label: "Tabelas PostgreSQL", value: tableInfoData.length, color: "text-green-500" },
                { label: "Funcionalidades", value: menuInfoData.length, color: "text-purple-500" },
                { label: "Monitoramentos", value: monitoramentosInfo.length, color: "text-orange-500" },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-3 rounded-xl bg-background/80 border border-border/50">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ───── 2. Stack Tecnológico ───── */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10"><Layers className="w-4 h-4 text-primary" /></div>
              Stack Tecnológico
            </CardTitle>
            <CardDescription>Tecnologias, frameworks e serviços que compõem o sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={systemInfoData.map((s) => s.category)} className="w-full">
              {systemInfoData.map((section) => (
                <AccordionItem key={section.category} value={section.category} className="border-border/50">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-muted">{section.icon}</div>
                      <div className="text-left">
                        <span className="font-semibold text-sm">{section.category}</span>
                        {section.description && (
                          <p className="text-xs text-muted-foreground font-normal mt-0.5">{section.description}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-auto mr-2 text-xs">{section.items.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-10">
                      {section.items.map((item) => (
                        <div key={item.name} className="p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{item.name}</span>
                              {item.value && <span className="text-xs text-muted-foreground font-mono">{item.value}</span>}
                            </div>
                            {item.badge && <Badge variant={item.badgeVariant || "secondary"} className="text-xs">{item.badge}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* ───── 3. Funcionalidades (Menu) ───── */}
        <Card className="shadow-md print-break">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10"><Menu className="w-4 h-4 text-primary" /></div>
              Funcionalidades do Sistema
              <Badge variant="outline" className="ml-2 text-xs">{menuInfoData.length} telas</Badge>
            </CardTitle>
            <CardDescription>Módulos disponíveis organizados por área</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {menuCategories.map((cat) => {
                const items = menuInfoData.filter((m) => m.category === cat);
                return (
                  <div key={cat}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {cat}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {items.map((menu) => (
                        <div key={menu.path} className="p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="p-1 rounded bg-muted">{menu.icon}</div>
                            <span className="font-medium text-sm">{menu.name}</span>
                            <Badge variant="outline" className="font-mono text-[10px] ml-auto">{menu.path}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{menu.description}</p>
                          {menu.tables && menu.tables.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {menu.tables.map((table) => (
                                <Badge key={table} variant="secondary" className="text-[10px] font-mono px-1.5 py-0">{table}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ───── 4. Sistema de Monitoramentos ───── */}
        <Card className="shadow-md print-break">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10"><RefreshCw className="w-4 h-4 text-primary" /></div>
              Sistema de Monitoramentos Automáticos
            </CardTitle>
            <CardDescription>Motor de monitoramento com execução escalonada 24/7</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overview */}
            <div className="p-4 rounded-xl border bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Tipos", value: monitoramentosInfo.length, icon: <Workflow className="w-4 h-4" /> },
                  { label: "Fontes Externas", value: "4", icon: <Globe className="w-4 h-4" /> },
                  { label: "Edge Functions", value: "12", icon: <Zap className="w-4 h-4" /> },
                  { label: "Operação", value: "24/7", icon: <Clock className="w-4 h-4" /> },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center gap-2 p-2 rounded-lg bg-background/80">
                    <div className="text-primary">{stat.icon}</div>
                    <div>
                      <p className="text-lg font-bold">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-primary" />
                Cronograma Diário (Horário de Brasília)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {arquiteturaExecucaoInfo.horariosAgendados.map((h) => (
                  <div key={h.tipo} className="flex items-center gap-2 p-2.5 rounded-lg border bg-card/50">
                    <Badge variant="outline" className="font-mono text-xs whitespace-nowrap">{h.horario}</Badge>
                    <div>
                      <p className="font-medium text-xs">{h.tipo}</p>
                      <p className="text-[10px] text-muted-foreground">{h.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monitoring Details */}
            <Accordion type="multiple" className="w-full">
              {monitoramentosInfo.map((mon) => (
                <AccordionItem key={mon.id} value={mon.id} className="border-border/50">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-primary/10">{mon.icon}</div>
                      <span className="font-semibold text-sm">{mon.nome}</span>
                      <Badge variant={mon.badgeVariant} className="text-xs">{mon.badge}</Badge>
                      <Badge variant="outline" className="text-[10px] font-mono ml-auto mr-2">{mon.horarioAgendado}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-10 space-y-4">
                      <p className="text-sm text-muted-foreground">{mon.descricao}</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border bg-muted/20">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Frequência</p>
                          <p className="font-medium text-sm">{mon.frequenciaPadrao} — {mon.horarioAgendado}</p>
                        </div>
                        <div className="p-3 rounded-lg border bg-muted/20">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Fontes de Dados</p>
                          <div className="flex flex-wrap gap-1">
                            {mon.fontesDados.map((f) => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">📋 Funcionamento:</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                          {mon.comoFunciona.map((p, i) => <li key={i}>{p}</li>)}
                        </ol>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">✅ Detecta:</p>
                          <ul className="list-disc list-inside space-y-0.5 text-sm text-muted-foreground">
                            {mon.oQueEncontra.map((item, i) => <li key={i}>{item}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Limitações:
                          </p>
                          <ul className="list-disc list-inside space-y-0.5 text-sm text-muted-foreground">
                            {mon.limitacoes.map((item, i) => <li key={i}>{item}</li>)}
                          </ul>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">🗄️ Tabelas:</p>
                          <div className="flex flex-wrap gap-1">
                            {mon.tabelasEnvolvidas.map((t) => <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}</Badge>)}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">⚡ Edge Functions:</p>
                          <div className="flex flex-wrap gap-1">
                            {mon.edgeFunctions.map((f) => <Badge key={f} variant="secondary" className="text-[10px] font-mono">{f}</Badge>)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {/* Architecture */}
            <div className="p-4 rounded-xl border bg-muted/20">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <Scale className="w-4 h-4 text-primary" />
                Arquitetura de Execução
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">
                    Orquestrador: <code className="bg-background px-1.5 py-0.5 rounded text-xs">{arquiteturaExecucaoInfo.orquestrador.nome}</code>
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                    {arquiteturaExecucaoInfo.orquestrador.funcionalidades.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-2">Tabelas de Controle:</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {arquiteturaExecucaoInfo.tabelasControle.map((t) => (
                      <div key={t.nome} className="p-2.5 rounded-lg border bg-background">
                        <p className="font-mono text-xs font-medium">{t.nome}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{t.descricao}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-2">Status de Execução:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {arquiteturaExecucaoInfo.statusPossiveis.map((s) => (
                      <div key={s.status} className="flex items-center gap-2 p-2 rounded-lg border bg-background">
                        <Badge variant="outline" className="font-mono text-[10px]">{s.status}</Badge>
                        <span className="text-xs text-muted-foreground">{s.descricao}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ───── 5. Edge Functions ───── */}
        <Card className="shadow-md print-break">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10"><Zap className="w-4 h-4 text-primary" /></div>
              Edge Functions (Serverless)
              <Badge variant="outline" className="ml-2 text-xs">{edgeFunctionsInfo.length} funções</Badge>
            </CardTitle>
            <CardDescription>Funções TypeScript/Deno executadas no Supabase Edge Runtime</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {edgeFunctionCategories.map((cat) => {
                const funcs = edgeFunctionsInfo.filter((f) => f.category === cat);
                return (
                  <div key={cat}>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {cat}
                      <Badge variant="outline" className="text-[10px]">{funcs.length}</Badge>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {funcs.map((func) => (
                        <div key={func.name} className="flex items-start gap-2 p-2 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                          <Code className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-mono text-[11px] font-medium">{func.name}</p>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{func.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ───── 6. Secrets ───── */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10"><KeyRound className="w-4 h-4 text-primary" /></div>
              Secrets e Configurações
            </CardTitle>
            <CardDescription>Chaves de API e credenciais — armazenadas no Supabase Vault</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {secretsInfo.map((secret) => (
                <div key={secret.name} className="flex items-start gap-3 p-3 rounded-lg border bg-card/50">
                  {secret.isPublic ? (
                    <Globe className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-xs font-medium">{secret.name}</p>
                      <Badge variant={secret.isPublic ? "secondary" : "outline"} className="text-[10px]">
                        {secret.isPublic ? "Pública" : "Secreta"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{secret.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ───── 7. Storage ───── */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10"><HardDrive className="w-4 h-4 text-primary" /></div>
              Storage Buckets
            </CardTitle>
            <CardDescription>Armazenamento de arquivos com CDN e políticas de acesso</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {storageBucketsInfo.map((bucket) => (
                <div key={bucket.name} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-mono text-xs font-medium">{bucket.name}</p>
                      <p className="text-[10px] text-muted-foreground">{bucket.description}</p>
                    </div>
                  </div>
                  <Badge variant={bucket.public ? "secondary" : "outline"} className="text-[10px]">
                    {bucket.public ? "Público" : "Privado"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ───── 8. Tabelas do Banco ───── */}
        <Card className="shadow-md print-break">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10"><Table className="w-4 h-4 text-primary" /></div>
              Tabelas do Banco de Dados
              <Badge variant="outline" className="ml-2 text-xs">{tableInfoData.length} tabelas</Badge>
            </CardTitle>
            <CardDescription>Esquema principal do PostgreSQL organizado por domínio</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] print:h-auto">
              <div className="space-y-5">
                {tableCategories.map((cat) => {
                  const tables = tableInfoData.filter((t) => t.category === cat);
                  return (
                    <div key={cat}>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {cat}
                        <Badge variant="outline" className="text-[10px]">{tables.length}</Badge>
                      </h3>
                      <Accordion type="multiple" className="w-full">
                        {tables.map((table) => (
                          <AccordionItem key={table.name} value={table.name} className="border-border/50">
                            <AccordionTrigger className="hover:no-underline py-2">
                              <div className="flex items-center gap-2">
                                <Table className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="font-mono text-xs">{table.name}</span>
                                <span className="text-[10px] text-muted-foreground ml-2">{table.description}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="pl-6 flex flex-wrap gap-1">
                                {table.columns.map((col) => (
                                  <Badge key={col} variant="outline" className="text-[10px] font-mono px-1.5 py-0">{col}</Badge>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ───── Footer (PDF) ───── */}
        <div className="hidden print:block mt-8 pt-4 border-t text-center">
          <p className="text-sm text-muted-foreground">
            Documento gerado automaticamente pelo JurisControl v{SYSTEM_VERSION}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            © {new Date().getFullYear()} Paixão Cortes Advogados — Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
