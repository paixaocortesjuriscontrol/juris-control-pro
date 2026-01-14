import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, ListTodo, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

const ImportarHub = () => {
  const navigate = useNavigate();

  return (
    <MainLayout title="Importar Dados" subtitle="Escolha o tipo de dados que deseja importar">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
        {/* Card Importar Processos */}
        <Card 
          className="hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full border-2 hover:border-primary/30" 
          onClick={() => navigate("/importar-processos")}
        >
          <CardHeader className="pb-3 md:pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 md:p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <FileSpreadsheet className="h-6 w-6 md:h-8 md:w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg md:text-xl">Importar Processos</CardTitle>
                <CardDescription className="text-sm">Importe processos de planilhas Excel</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4 flex-1 flex flex-col">
            <p className="text-sm text-muted-foreground">
              Importe processos judiciais a partir de diferentes formatos de planilha. O sistema detecta automaticamente 
              clientes existentes e realiza mesclagem inteligente de dados.
            </p>
            
            <div className="space-y-2 flex-1">
              <p className="text-sm font-medium">Formatos disponíveis:</p>
              <ul className="text-sm text-muted-foreground space-y-1 md:space-y-1.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Padrão</strong> - Modelo padrão com campos básicos</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Osmar/Janaina/Polyana</strong> - Formatos por coordenação</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>MPT</strong> - Ministério Público do Trabalho</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Pedidos</strong> - Atualização de pedidos existentes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Astrea</strong> - Migração do sistema Astrea</span>
                </li>
              </ul>
            </div>

            <div className="p-2.5 md:p-3 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Mesclagem Inteligente
              </div>
              <p className="text-xs text-muted-foreground">
                Dados importados preenchem apenas campos vazios, preservando responsáveis e coordenações.
              </p>
            </div>

            <Button className="w-full mt-auto" variant="default">
              Acessar Importação de Processos
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Card Importar Tarefas */}
        <Card 
          className="hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full border-2 hover:border-secondary/50" 
          onClick={() => navigate("/importar-tarefas")}
        >
          <CardHeader className="pb-3 md:pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 md:p-3 rounded-lg bg-secondary/50 text-secondary-foreground group-hover:bg-secondary transition-colors">
                <ListTodo className="h-6 w-6 md:h-8 md:w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg md:text-xl">Importar Tarefas</CardTitle>
                <CardDescription className="text-sm">Importe tarefas e prazos de planilhas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4 flex-1 flex flex-col">
            <p className="text-sm text-muted-foreground">
              Importe tarefas e prazos vinculados a processos. O sistema pode criar automaticamente processos e 
              usuários inexistentes durante a importação.
            </p>
            
            <div className="space-y-2 flex-1">
              <p className="text-sm font-medium">Funcionalidades:</p>
              <ul className="text-sm text-muted-foreground space-y-1 md:space-y-1.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Vincular Processos</strong> - Associa a processos existentes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Criar Processos</strong> - Cria se não existirem</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Cadastrar Responsáveis</strong> - Cria perfis automaticamente</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Vincular Coordenação</strong> - Associa novos usuários</span>
                </li>
              </ul>
            </div>

            <div className="p-2.5 md:p-3 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Importação em Lote
              </div>
              <p className="text-xs text-muted-foreground">
                Escolha importar apenas pendentes ou incluir cumpridas. Cancelável a qualquer momento.
              </p>
            </div>

            <Button className="w-full mt-auto" variant="secondary">
              Acessar Importação de Tarefas
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default ImportarHub;
