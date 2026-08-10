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
import { AdminOrCoordRoute } from "@/components/layout/AdminOrCoordRoute";
import AuditoriaItens from "./pages/AuditoriaItens";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Processos from "./pages/Processos";
import ProcessoDetalhes from "./pages/ProcessoDetalhes";
// /processos/novo reutiliza a mesma tela de ProcessoDetalhes em modo criação
import BuscarProcessos from "./pages/BuscarProcessos";
import Coordenacoes from "./pages/Coordenacoes";
import ModelosTitulo from "./pages/ModelosTitulo";
import Relatorios from "./pages/Relatorios";
import Administracao from "./pages/Administracao";
import PoolProxyDjen from "./pages/PoolProxyDjen";
import ValidaKurier from "./pages/ValidaKurier";
import ConsultaExterna from "./pages/ConsultaExterna";
import ImportarProcessos from "./pages/ImportarProcessos";
import ImportarHub from "./pages/ImportarHub";
import Configuracoes from "./pages/Configuracoes";
import Prazos from "./pages/Prazos";
import ListaAtividades from "./pages/ListaAtividades";
import Documentos from "./pages/Documentos";
import BuscarPJE from "./pages/BuscarPJE";
import BuscarDjEstadual from "./pages/BuscarDjEstadual";
import NotFound from "./pages/NotFound";
import Clientes from "./pages/Clientes";
import ClienteDetalhes from "./pages/ClienteDetalhes";
import CompararDjSantander from "./pages/CompararDjSantander";
import ErrataDjen from "./pages/ErrataDjen";
import MonitoramentoDistribuicao from "./pages/MonitoramentoDistribuicao";
import Monitoramento360 from "./pages/Monitoramento360";
import MonitoramentoDjen from "./pages/MonitoramentoDjen";
import DjenServidor from "./pages/DjenServidor";
import MonitoracaoHub from "./pages/MonitoracaoHub";
import MinhaCarteira from "./pages/MinhaCarteira";
import AnaliseDjen from "./pages/AnaliseDjen";
import AnaliseDjenServidor from "./pages/AnaliseDjenServidor";
import ComparaDocsTst from "./pages/ComparaDocsTst";
import TermosDjen from "./pages/TermosDjen";
import ManualSistema from "./pages/ManualSistema";
import Pastas from "./pages/Pastas";
import PastaDetalhes from "./pages/PastaDetalhes";
import Notificacoes from "./pages/Notificacoes";
import Indicadores from "./pages/Indicadores";
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
import RemessasBenner from "./pages/RemessasBenner";
import ConfiguracoesCargaBenner from "./pages/ConfiguracoesCargaBenner";
import DadosBenner from "./pages/DadosBenner";
import DistribuicaoTst from "./pages/DistribuicaoTst";
import DistribuicaoTstKanban from "./pages/DistribuicaoTstKanban";
import DistribuicaoTstArquivados from "./pages/DistribuicaoTstArquivados";
import PromptIaTst from "./pages/PromptIaTst";
import PromptIaPublicacoes from "./pages/PromptIaPublicacoes";
import Etiquetas from "./pages/Etiquetas";
import PautasTst from "./pages/PautasTst";
import CorrigirPlanilha from "./pages/CorrigirPlanilha";
import MateriasBenner from "./pages/MateriasBenner";
import ClassificacaoTst from "./pages/ClassificacaoTst";
import IaResponde from "./pages/IaResponde";
import ConsumoIA from "./pages/ConsumoIA";
import ConsumoJudit from "./pages/ConsumoJudit";
import AdminTst from "./pages/AdminTst";
import AdminTstImportacoes from "./pages/AdminTstImportacoes";
import ImportarCertidaoPdf from "./pages/admin-tst/ImportarCertidaoPdf";
import ImportarDistribuicao from "./pages/admin-tst/ImportarDistribuicao";
import AtualizarDossies from "./pages/admin-tst/AtualizarDossies";
import AtualizarEquipe from "./pages/admin-tst/AtualizarEquipe";
import AtualizarSituacaoEnvio from "./pages/admin-tst/AtualizarSituacaoEnvio";
import RespostaSantander from "./pages/admin-tst/RespostaSantander";
import BennerSim from "./pages/admin-tst/BennerSim";
import AuditoriaDistribuicaoTst from "./pages/admin-tst/AuditoriaDistribuicaoTst";
import AuditoriaLotesAdminTst from "./pages/admin-tst/AuditoriaLotesAdminTst";
import AdminTstOutroEscritorio from "./pages/AdminTstOutroEscritorio";
import AdminTstBasePcaDistribuicoes from "./pages/AdminTstBasePcaDistribuicoes";
import BuscaPublicacao from "./pages/BuscaPublicacao";
import DjenLocal from "./pages/DjenLocal";
import { useVersionCheck } from "@/hooks/useVersionCheck";

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
  useVersionCheck();
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
              <Route path="/indicadores" element={<ProtectedRoute><Indicadores /></ProtectedRoute>} />
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
              <Route path="/processos/novo" element={<ProtectedRoute><ProcessoDetalhes /></ProtectedRoute>} />
              <Route path="/processos/:id" element={<ProtectedRoute><ProcessoDetalhes /></ProtectedRoute>} />
              <Route path="/prazos" element={<ProtectedRoute><Prazos /></ProtectedRoute>} />
              <Route path="/lista-atividades" element={<ProtectedRoute><ListaAtividades /></ProtectedRoute>} />
              <Route path="/buscar" element={<ProtectedRoute><BuscarProcessos /></ProtectedRoute>} />
              <Route path="/coordenacoes" element={<ProtectedRoute><Coordenacoes /></ProtectedRoute>} />
              <Route path="/modelos-titulo" element={<ProtectedRoute><ModelosTitulo /></ProtectedRoute>} />
              <Route path="/painel-equipe" element={<ProtectedRoute><PainelEquipe /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminRoute><Administracao /></AdminRoute>} />
              <Route path="/consumo-ia" element={<AdminRoute><ConsumoIA /></AdminRoute>} />
              <Route path="/consumo-judit" element={<AdminRoute><ConsumoJudit /></AdminRoute>} />
              <Route path="/auditoria-itens" element={<AdminOrCoordRoute><AuditoriaItens /></AdminOrCoordRoute>} />
              <Route path="/pool-proxy-djen" element={<AdminRoute><PoolProxyDjen /></AdminRoute>} />
              <Route path="/valida-kurier" element={<AdminRoute><ValidaKurier /></AdminRoute>} />
              <Route path="/consulta-externa" element={<ProtectedRoute><ConsultaExterna /></ProtectedRoute>} />
              <Route path="/importar" element={<ProtectedRoute><ImportarHub /></ProtectedRoute>} />
              <Route path="/importar-processos" element={<ProtectedRoute><ImportarProcessos /></ProtectedRoute>} />
              <Route path="/importar-tarefas" element={<ProtectedRoute><ImportarTarefas /></ProtectedRoute>} />
              <Route path="/documentos" element={<ProtectedRoute><Documentos /></ProtectedRoute>} />
              <Route path="/analise-djen" element={<ProtectedRoute><AnaliseDjen /></ProtectedRoute>} />
              <Route path="/analise-djen-servidor" element={<AdminRoute><AnaliseDjenServidor /></AdminRoute>} />
              <Route path="/termos-djen" element={<ProtectedRoute><TermosDjen /></ProtectedRoute>} />
              <Route path="/manual-sistema" element={<ProtectedRoute><ManualSistema /></ProtectedRoute>} />
              <Route path="/buscar-pje" element={<ProtectedRoute><BuscarPJE /></ProtectedRoute>} />
              <Route path="/buscar-dj-estadual" element={<ProtectedRoute><BuscarDjEstadual /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<AdminRoute><Configuracoes /></AdminRoute>} />
              <Route path="/monitoramento-distribuicao" element={<ProtectedRoute><MonitoramentoDistribuicao /></ProtectedRoute>} />
              <Route path="/monitoramento-360" element={<ProtectedRoute><Monitoramento360 /></ProtectedRoute>} />
              <Route path="/monitoramento-djen" element={<ProtectedRoute><MonitoramentoDjen /></ProtectedRoute>} />
              <Route path="/djen-servidor" element={<AdminRoute><DjenServidor /></AdminRoute>} />
              <Route path="/djen-local" element={<AdminRoute><DjenLocal /></AdminRoute>} />
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
              <Route path="/carga-benner" element={<ProtectedRoute><CargaBenner /></ProtectedRoute>} />
              <Route path="/remessas-benner" element={<ProtectedRoute><RemessasBenner /></ProtectedRoute>} />
              <Route path="/remessas-benner/configuracoes" element={<ProtectedRoute><ConfiguracoesCargaBenner /></ProtectedRoute>} />
              <Route path="/dados-benner" element={<ProtectedRoute><DadosBenner /></ProtectedRoute>} />
              <Route path="/distribuicao-tst" element={<ProtectedRoute><DistribuicaoTst /></ProtectedRoute>} />
              <Route path="/distribuicao-tst/kanban" element={<ProtectedRoute><DistribuicaoTstKanban /></ProtectedRoute>} />
              <Route path="/distribuicao-tst/arquivados" element={<AdminRoute><DistribuicaoTstArquivados /></AdminRoute>} />
              <Route path="/prompts-ia-tst" element={<ProtectedRoute><PromptIaTst /></ProtectedRoute>} />
              <Route path="/prompt-ia-publicacoes" element={<ProtectedRoute><PromptIaPublicacoes /></ProtectedRoute>} />
              <Route path="/etiquetas" element={<Etiquetas />} />
              <Route path="/materias-benner" element={<ProtectedRoute><MateriasBenner /></ProtectedRoute>} />
              <Route path="/pautas-tst" element={<ProtectedRoute><PautasTst /></ProtectedRoute>} />
              <Route path="/classificacao-tst" element={<ProtectedRoute><ClassificacaoTst /></ProtectedRoute>} />
              <Route path="/comparar-dj-santander" element={<ProtectedRoute><CompararDjSantander /></ProtectedRoute>} />
              <Route path="/errata-djen" element={<ProtectedRoute><ErrataDjen /></ProtectedRoute>} />
              <Route path="/compara-docs-tst" element={<ProtectedRoute><ComparaDocsTst /></ProtectedRoute>} />
              <Route path="/corrigir-planilha" element={<ProtectedRoute><CorrigirPlanilha /></ProtectedRoute>} />
              <Route path="/ia-responde" element={<AdminRoute><IaResponde /></AdminRoute>} />
              <Route path="/admin-tst" element={<ProtectedRoute><AdminTst /></ProtectedRoute>} />
              <Route path="/admin-tst/importacoes-distribuicao" element={<ProtectedRoute><AdminTstImportacoes /></ProtectedRoute>} />
              <Route path="/admin-tst/importar-certidao-pdf" element={<ProtectedRoute><ImportarCertidaoPdf /></ProtectedRoute>} />
              <Route path="/admin-tst/importar-distribuicao" element={<ProtectedRoute><ImportarDistribuicao /></ProtectedRoute>} />
              <Route path="/admin-tst/atualizar-dossies" element={<ProtectedRoute><AtualizarDossies /></ProtectedRoute>} />
              <Route path="/admin-tst/atualizar-equipe" element={<ProtectedRoute><AtualizarEquipe /></ProtectedRoute>} />
              <Route path="/admin-tst/atualizar-situacao-envio" element={<AdminRoute><AtualizarSituacaoEnvio /></AdminRoute>} />
              <Route path="/admin-tst/resposta-santander" element={<AdminRoute><RespostaSantander /></AdminRoute>} />
              <Route path="/admin-tst/benner-sim" element={<ProtectedRoute><BennerSim /></ProtectedRoute>} />
              <Route path="/admin-tst/outro-escritorio" element={<AdminRoute><AdminTstOutroEscritorio /></AdminRoute>} />
              <Route path="/admin-tst/busca-publicacao" element={<AdminRoute><BuscaPublicacao /></AdminRoute>} />
              <Route path="/admin-tst/base-pca-distribuicoes" element={<AdminRoute><AdminTstBasePcaDistribuicoes /></AdminRoute>} />
              <Route path="/admin-tst/auditoria-distribuicao" element={<AdminRoute><AuditoriaDistribuicaoTst /></AdminRoute>} />
              <Route path="/admin-tst/auditoria-lotes" element={<AdminRoute><AuditoriaLotesAdminTst /></AdminRoute>} />
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
