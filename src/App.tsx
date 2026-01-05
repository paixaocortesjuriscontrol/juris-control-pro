import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImportProvider } from "@/contexts/ImportContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
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
import MinhaCarteira from "./pages/MinhaCarteira";
import AnaliseDjen from "./pages/AnaliseDjen";
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
import CentralDelegacao from "./pages/CentralDelegacao";
import PainelIntimacoes from "./pages/PainelIntimacoes";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ImportProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/central-delegacao" element={<ProtectedRoute><CentralDelegacao /></ProtectedRoute>} />
              <Route path="/minha-agenda" element={<ProtectedRoute><MinhaAgenda /></ProtectedRoute>} />
              <Route path="/minha-carteira" element={<ProtectedRoute><MinhaCarteira /></ProtectedRoute>} />
              <Route path="/notificacoes" element={<ProtectedRoute><Notificacoes /></ProtectedRoute>} />
              <Route path="/processos" element={<ProtectedRoute><Processos /></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
              <Route path="/clientes/:id" element={<ProtectedRoute><ClienteDetalhes /></ProtectedRoute>} />
              <Route path="/processos/:id" element={<ProtectedRoute><ProcessoDetalhes /></ProtectedRoute>} />
              <Route path="/prazos" element={<ProtectedRoute><Prazos /></ProtectedRoute>} />
              <Route path="/buscar" element={<ProtectedRoute><BuscarProcessos /></ProtectedRoute>} />
              <Route path="/coordenacoes" element={<ProtectedRoute><Coordenacoes /></ProtectedRoute>} />
              <Route path="/painel-equipe" element={<ProtectedRoute><PainelEquipe /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Administracao /></ProtectedRoute>} />
              <Route path="/consulta-externa" element={<ProtectedRoute><ConsultaExterna /></ProtectedRoute>} />
              <Route path="/importar" element={<ProtectedRoute><ImportarProcessos /></ProtectedRoute>} />
              <Route path="/importar-tarefas" element={<ProtectedRoute><ImportarTarefas /></ProtectedRoute>} />
              <Route path="/documentos" element={<ProtectedRoute><Documentos /></ProtectedRoute>} />
              <Route path="/buscar-djen" element={<ProtectedRoute><BuscarDJEN /></ProtectedRoute>} />
              <Route path="/analise-djen" element={<ProtectedRoute><AnaliseDjen /></ProtectedRoute>} />
              <Route path="/buscar-pje" element={<ProtectedRoute><BuscarPJE /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
              <Route path="/redistribuicoes" element={<ProtectedRoute><Redistribuicoes /></ProtectedRoute>} />
              <Route path="/monitoramento-distribuicao" element={<ProtectedRoute><MonitoramentoDistribuicao /></ProtectedRoute>} />
              <Route path="/monitoramento-360" element={<ProtectedRoute><Monitoramento360 /></ProtectedRoute>} />
              <Route path="/monitoramento-djen" element={<ProtectedRoute><MonitoramentoDjen /></ProtectedRoute>} />
              <Route path="/pastas" element={<ProtectedRoute><Pastas /></ProtectedRoute>} />
              <Route path="/pastas/:id" element={<ProtectedRoute><PastaDetalhes /></ProtectedRoute>} />
              <Route path="/analise-tarefas-projuris" element={<ProtectedRoute><AnaliseTarefasProjuris /></ProtectedRoute>} />
              <Route path="/repositorio" element={<ProtectedRoute><RepositorioDocumentos /></ProtectedRoute>} />
              <Route path="/assistente-juridico" element={<ProtectedRoute><AssistenteJuridico /></ProtectedRoute>} />
              <Route path="/painel-audiencias" element={<ProtectedRoute><PainelAudiencias /></ProtectedRoute>} />
              <Route path="/painel-intimacoes" element={<ProtectedRoute><PainelIntimacoes /></ProtectedRoute>} />
              <Route path="/auditoria-djen-processos" element={<ProtectedRoute><AuditoriaDjenProcessos /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ImportProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
