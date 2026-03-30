import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImportProvider } from "@/contexts/ImportContext";
import { SidebarContextProvider } from "@/contexts/SidebarContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AdminRoute } from "@/components/layout/AdminRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Processos from "./pages/Processos";
import ProcessoDetalhes from "./pages/ProcessoDetalhes";
import BuscarProcessos from "./pages/BuscarProcessos";
import Coordenacoes from "./pages/Coordenacoes";
import Relatorios from "./pages/Relatorios";
import Administracao from "./pages/Administracao";
import ConsultaExterna from "./pages/ConsultaExterna";
import ImportarProcessos from "./pages/ImportarProcessos";
import ImportarHub from "./pages/ImportarHub";
import Configuracoes from "./pages/Configuracoes";
import Prazos from "./pages/Prazos";
import Documentos from "./pages/Documentos";
import BuscarDJEN from "./pages/BuscarDJEN";
import BuscarPJE from "./pages/BuscarPJE";
import NotFound from "./pages/NotFound";
import Redistribuicoes from "./pages/Redistribuicoes";
import Clientes from "./pages/Clientes";
import ClienteDetalhes from "./pages/ClienteDetalhes";
import MonitoramentoDistribuicao from "./pages/MonitoramentoDistribuicao";
import Monitoramento360 from "./pages/Monitoramento360";
import MonitoramentoDjen from "./pages/MonitoramentoDjen";
import MonitoracaoHub from "./pages/MonitoracaoHub";
import MinhaCarteira from "./pages/MinhaCarteira";
import AnaliseDjen from "./pages/AnaliseDjen";
import TermosDjen from "./pages/TermosDjen";
import Pastas from "./pages/Pastas";
import PastaDetalhes from "./pages/PastaDetalhes";
import Notificacoes from "./pages/Notificacoes";
import AnaliseTarefasProjuris from "./pages/AnaliseTarefasProjuris";
import ImportarTarefas from "./pages/ImportarTarefas";
import PainelEquipe from "./pages/PainelEquipe";
import RepositorioDocumentos from "./pages/RepositorioDocumentos";
import AssistenteJuridico from "./pages/AssistenteJuridico";
import PainelAudiencias from "./pages/PainelAudiencias";
import AuditoriaDjenProcessos from "./pages/AuditoriaDjenProcessos";
import MinhaAgenda from "./pages/MinhaAgenda";
import PainelControle from "./pages/PainelControle";
import PainelIntimacoes from "./pages/PainelIntimacoes";
import NovaTarefa from "./pages/NovaTarefa";
import CofreSenhas from "./pages/CofreSenhas";
import CapturasIntimacoes from "./pages/CapturasIntimacoes";
import RelatorioExecucoes from "./pages/RelatorioExecucoes";
import ClienteLogin from "./pages/cliente/ClienteLogin";
import ClienteCadastro from "./pages/cliente/ClienteCadastro";
import ClientePortal from "./pages/cliente/ClientePortal";
import WorkerDjenVps from "./pages/WorkerDjenVps";
import TstPrazos from "./pages/TstPrazos";
import AnalisarPrazos from "./pages/AnalisarPrazos";
import PlanilhaTst from "./pages/PlanilhaTst";
import CargaBenner from "./pages/CargaBenner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh
      gcTime: 30 * 60 * 1000, // 30 minutes - cache time
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SidebarContextProvider>
            <ImportProvider>
              <Routes>
                {/* Client Portal Routes (separate from internal system) */}
                <Route path="/cliente/login" element={<ClienteLogin />} />
                <Route path="/cliente/cadastro" element={<ClienteCadastro />} />
                <Route path="/cliente" element={<ClientePortal />} />
                
                {/* VPS Worker Route - headless page for distributed DJEN search */}
                <Route path="/worker-djen-vps" element={<ProtectedRoute><WorkerDjenVps /></ProtectedRoute>} />
              
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><Navigate to="/painel-controle" replace /></ProtectedRoute>} />
              <Route path="/notificacoes" element={<ProtectedRoute><Notificacoes /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              {/* Redirect central-delegacao to unified agenda */}
            <Route path="/central-delegacao" element={<Navigate to="/minha-agenda" replace />} />
            <Route path="/prazos" element={<Navigate to="/minha-agenda" replace />} />
              <Route path="/nova-tarefa" element={<ProtectedRoute><NovaTarefa /></ProtectedRoute>} />
              <Route path="/minha-agenda" element={<ProtectedRoute><MinhaAgenda /></ProtectedRoute>} />
              <Route path="/painel-controle" element={<ProtectedRoute><PainelControle /></ProtectedRoute>} />
              <Route path="/minha-carteira" element={<Navigate to="/minha-agenda" replace />} />
              <Route path="/processos" element={<ProtectedRoute><Processos /></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
              <Route path="/clientes/:id" element={<ProtectedRoute><ClienteDetalhes /></ProtectedRoute>} />
              <Route path="/processos/:id" element={<ProtectedRoute><ProcessoDetalhes /></ProtectedRoute>} />
              <Route path="/prazos" element={<ProtectedRoute><Prazos /></ProtectedRoute>} />
              <Route path="/buscar" element={<ProtectedRoute><BuscarProcessos /></ProtectedRoute>} />
              <Route path="/coordenacoes" element={<ProtectedRoute><Coordenacoes /></ProtectedRoute>} />
              <Route path="/painel-equipe" element={<ProtectedRoute><PainelEquipe /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminRoute><Administracao /></AdminRoute>} />
              <Route path="/consulta-externa" element={<ProtectedRoute><ConsultaExterna /></ProtectedRoute>} />
              <Route path="/importar" element={<ProtectedRoute><ImportarHub /></ProtectedRoute>} />
              <Route path="/importar-processos" element={<ProtectedRoute><ImportarProcessos /></ProtectedRoute>} />
              <Route path="/importar-tarefas" element={<ProtectedRoute><ImportarTarefas /></ProtectedRoute>} />
              <Route path="/documentos" element={<ProtectedRoute><Documentos /></ProtectedRoute>} />
              <Route path="/buscar-djen" element={<ProtectedRoute><BuscarDJEN /></ProtectedRoute>} />
              <Route path="/analise-djen" element={<ProtectedRoute><AnaliseDjen /></ProtectedRoute>} />
              <Route path="/termos-djen" element={<ProtectedRoute><TermosDjen /></ProtectedRoute>} />
              <Route path="/buscar-pje" element={<ProtectedRoute><BuscarPJE /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<AdminRoute><Configuracoes /></AdminRoute>} />
              <Route path="/redistribuicoes" element={<ProtectedRoute><Redistribuicoes /></ProtectedRoute>} />
              <Route path="/monitoramento-distribuicao" element={<ProtectedRoute><MonitoramentoDistribuicao /></ProtectedRoute>} />
              <Route path="/monitoramento-360" element={<ProtectedRoute><Monitoramento360 /></ProtectedRoute>} />
              <Route path="/monitoramento-djen" element={<ProtectedRoute><MonitoramentoDjen /></ProtectedRoute>} />
              <Route path="/monitoracao" element={<AdminRoute><MonitoracaoHub /></AdminRoute>} />
              <Route path="/pastas" element={<ProtectedRoute><Pastas /></ProtectedRoute>} />
              <Route path="/pastas/:id" element={<ProtectedRoute><PastaDetalhes /></ProtectedRoute>} />
              <Route path="/analise-tarefas-projuris" element={<ProtectedRoute><AnaliseTarefasProjuris /></ProtectedRoute>} />
              <Route path="/repositorio" element={<ProtectedRoute><RepositorioDocumentos /></ProtectedRoute>} />
              <Route path="/assistente-juridico" element={<ProtectedRoute><AssistenteJuridico /></ProtectedRoute>} />
              <Route path="/painel-audiencias" element={<ProtectedRoute><PainelAudiencias /></ProtectedRoute>} />
              <Route path="/painel-intimacoes" element={<ProtectedRoute><PainelIntimacoes /></ProtectedRoute>} />
              <Route path="/auditoria-djen-processos" element={<ProtectedRoute><AuditoriaDjenProcessos /></ProtectedRoute>} />
              <Route path="/cofre-senhas" element={<ProtectedRoute><CofreSenhas /></ProtectedRoute>} />
              <Route path="/capturas-intimacoes" element={<ProtectedRoute><CapturasIntimacoes /></ProtectedRoute>} />
              <Route path="/relatorio-execucoes" element={<ProtectedRoute><RelatorioExecucoes /></ProtectedRoute>} />
              <Route path="/tst-prazos" element={<ProtectedRoute><TstPrazos /></ProtectedRoute>} />
              <Route path="/analisar-prazos" element={<ProtectedRoute><AnalisarPrazos /></ProtectedRoute>} />
              <Route path="/planilha-tst" element={<ProtectedRoute><PlanilhaTst /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ImportProvider>
            </SidebarContextProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
