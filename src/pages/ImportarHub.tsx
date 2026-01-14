import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, ListTodo, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

const ImportarHub = () => {
  const navigate = useNavigate();

  return (
    <MainLayout title="Importar Dados" subtitle="Escolha o tipo de dados que deseja importar">
      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* Card Importar Processos */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => navigate("/importar-processos")}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-xl">Importar Processos</CardTitle>
                <CardDescription>Importe processos de planilhas Excel</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Importe processos judiciais a partir de diferentes formatos de planilha. O sistema detecta automaticamente 
              clientes existentes e realiza mesclagem inteligente de dados.
            </p>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Formatos disponíveis:</p>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Padrão</strong> - Modelo padrão com campos básicos do processo</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Osmar/Janaina/Polyana</strong> - Formatos específicos por coordenação</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>MPT</strong> - Processos do Ministério Público do Trabalho</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Pedidos</strong> - Atualização de pedidos em processos existentes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Astrea</strong> - Migração de dados do sistema Astrea</span>
                </li>
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Mesclagem Inteligente
              </div>
              <p className="text-xs text-muted-foreground">
                Os dados importados só preenchem campos vazios no banco, preservando responsáveis e coordenações já configurados.
              </p>
            </div>

            <Button className="w-full group-hover:bg-primary" variant="outline">
              Acessar Importação de Processos
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Card Importar Tarefas */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => navigate("/importar-tarefas")}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-secondary/50 text-secondary-foreground group-hover:bg-secondary transition-colors">
                <ListTodo className="h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-xl">Importar Tarefas</CardTitle>
                <CardDescription>Importe tarefas e prazos de planilhas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Importe tarefas e prazos vinculados a processos. O sistema pode criar automaticamente processos e 
              usuários inexistentes durante a importação.
            </p>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Funcionalidades:</p>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Vincular Processos</strong> - Associa tarefas a processos existentes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Criar Processos</strong> - Cria processos automaticamente se não existirem</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Cadastrar Responsáveis</strong> - Cria perfis para responsáveis não identificados</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Vincular à Coordenação</strong> - Associa novos usuários à coordenação selecionada</span>
                </li>
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Importação em Lote
              </div>
              <p className="text-xs text-muted-foreground">
                Escolha importar apenas tarefas pendentes ou incluir também as já cumpridas. O processo pode ser cancelado a qualquer momento.
              </p>
            </div>

            <Button className="w-full group-hover:bg-secondary" variant="outline">
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
