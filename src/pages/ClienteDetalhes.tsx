import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  User, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Scale,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const areaLabels: Record<string, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  pendente: "Pendente",
  urgente: "Urgente",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
};

export default function ClienteDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: processos = [], isLoading: loadingProcessos } = useQuery({
    queryKey: ["processos-cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select(`
          id,
          numero,
          assunto,
          area,
          status,
          polo_ativo,
          polo_passivo,
          data_distribuicao,
          advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(id, nome)
        `)
        .eq("cliente_id", id!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  if (loadingCliente) {
    return (
      <MainLayout title="Carregando..." subtitle="">
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  if (!cliente) {
    return (
      <MainLayout title="Cliente não encontrado" subtitle="">
        <div className="text-center py-12">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Cliente não encontrado</h3>
          <p className="text-muted-foreground mb-4">O cliente solicitado não existe ou você não tem acesso.</p>
          <Button onClick={() => navigate("/clientes")}>Voltar para Clientes</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title={cliente.nome}
      subtitle={cliente.tipo === "pessoa_fisica" ? "Pessoa Física" : "Pessoa Jurídica"}
    >
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate("/clientes")} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Clientes
        </Button>

        {/* Client Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {cliente.tipo === "pessoa_fisica" ? (
                <User className="w-5 h-5" />
              ) : (
                <Building2 className="w-5 h-5" />
              )}
              Informações do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{cliente.nome}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Tipo</p>
                <Badge variant={cliente.tipo === "pessoa_fisica" ? "outline" : "secondary"}>
                  {cliente.tipo === "pessoa_fisica" ? "Pessoa Física" : "Pessoa Jurídica"}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {cliente.tipo === "pessoa_fisica" ? "CPF" : "CNPJ"}
                </p>
                <p className="font-medium">{cliente.cpf_cnpj || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="w-4 h-4" /> Email
                </p>
                <p className="font-medium">{cliente.email || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="w-4 h-4" /> Telefone
                </p>
                <p className="font-medium">{cliente.telefone || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> Endereço
                </p>
                <p className="font-medium">{cliente.endereco || "—"}</p>
              </div>
              {cliente.observacoes && (
                <div className="md:col-span-2 lg:col-span-3 space-y-1">
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="font-medium">{cliente.observacoes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Processes Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Processos Vinculados
              <Badge variant="secondary" className="ml-2">{processos.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingProcessos ? (
              <div className="p-6 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : processos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>Nenhum processo vinculado a este cliente.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Distribuição</TableHead>
                    <TableHead>Advogado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processos.map((processo) => (
                    <TableRow 
                      key={processo.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/processos/${processo.id}`)}
                    >
                      <TableCell className="font-mono font-medium">{processo.numero}</TableCell>
                      <TableCell className="max-w-xs truncate">{processo.assunto || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`badge-area-${processo.area}`}>
                          {areaLabels[processo.area] || processo.area}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`badge-status-${processo.status}`}>
                          {statusLabels[processo.status] || processo.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(processo.data_distribuicao)}</TableCell>
                      <TableCell>{processo.advogado_responsavel?.nome || "Não atribuído"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}