import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/processos" element={<ProtectedRoute><Processos /></ProtectedRoute>} />
            <Route path="/processos/:id" element={<ProtectedRoute><ProcessoDetalhes /></ProtectedRoute>} />
            <Route path="/prazos" element={<ProtectedRoute><Prazos /></ProtectedRoute>} />
            <Route path="/buscar" element={<ProtectedRoute><BuscarProcessos /></ProtectedRoute>} />
            <Route path="/coordenacoes" element={<ProtectedRoute><Coordenacoes /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Administracao /></ProtectedRoute>} />
            <Route path="/consulta-externa" element={<ProtectedRoute><ConsultaExterna /></ProtectedRoute>} />
            <Route path="/importar" element={<ProtectedRoute><ImportarProcessos /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
