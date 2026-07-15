import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProcessoFormDialog } from "@/components/processos/ProcessoFormDialog";

/**
 * Página de criação de processo. Renderiza o mesmo formulário do diálogo
 * "Novo Processo" (com abas Dados Básicos / Tribunal / Partes / Administrativo /
 * Contingencial / Documentos / Análise Judit / Anexos Judit e botões Buscar Dados
 * e Judit funcionando), porém como página inteira em vez de modal.
 *
 * Após salvar, o usuário é redirecionado para `/processos/:id` (tela de detalhe).
 */
export default function NovoProcesso() {
  const navigate = useNavigate();

  return (
    <MainLayout title="Novo Processo">
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/processos")}
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
      </div>

      <ProcessoFormDialog
        open
        asPage
        onOpenChange={(o) => {
          if (!o) navigate("/processos");
        }}
      />
    </MainLayout>
  );
}