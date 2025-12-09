import { useState, useEffect } from "react";
import { Plus, Users, Briefcase, MoreVertical, Mail, Phone } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";

const areaColors = {
  civil: "border-l-area-civil bg-area-civil/5",
  trabalhista: "border-l-area-trabalhista bg-area-trabalhista/5",
  empresarial: "border-l-area-empresarial bg-area-empresarial/5",
};

const areaLabels = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

const Coordenacoes = () => {
  const { data: coordenacoes, isLoading } = useCoordenacoesFull();
  const [selectedCoord, setSelectedCoord] = useState<any>(null);

  useEffect(() => {
    if (coordenacoes && coordenacoes.length > 0 && !selectedCoord) {
      setSelectedCoord(coordenacoes[0]);
    }
  }, [coordenacoes, selectedCoord]);

  if (isLoading) {
    return (
      <MainLayout 
        title="Coordenações" 
        subtitle="Gestão de equipes e distribuição de processos"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!coordenacoes || coordenacoes.length === 0) {
    return (
      <MainLayout 
        title="Coordenações" 
        subtitle="Gestão de equipes e distribuição de processos"
      >
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma coordenação cadastrada</h3>
          <p className="text-muted-foreground">Crie coordenações para organizar sua equipe</p>
        </div>
      </MainLayout>
    );
  }

  const getInitials = (name: string) => {
    return name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "ND";
  };

  return (
    <MainLayout 
      title="Coordenações" 
      subtitle="Gestão de equipes e distribuição de processos"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coordinations List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Equipes</h2>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Nova</span>
            </Button>
          </div>

          {coordenacoes.map((coord, index) => (
            <Card 
              key={coord.id}
              className={cn(
                "cursor-pointer transition-all border-l-4 hover:shadow-medium animate-slide-up",
                areaColors[coord.area as keyof typeof areaColors],
                selectedCoord?.id === coord.id && "ring-2 ring-primary/20"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => setSelectedCoord(coord)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{coord.nome}</h3>
                    <p className="text-sm text-muted-foreground">{coord.coordenador?.nome || "Sem coordenador"}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {areaLabels[coord.area as keyof typeof areaLabels]}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Briefcase className="w-4 h-4" />
                    <span className="font-medium text-foreground">{coord.processCount}</span> processos
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="font-medium text-foreground">{coord.membros.length}</span> membros
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Selected Coordination Details */}
        {selectedCoord && (
          <div className="lg:col-span-2 space-y-6">
            {/* Coordinator Info */}
            <Card className="animate-fade-in">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                        {getInitials(selectedCoord.coordenador?.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="font-serif">{selectedCoord.nome}</CardTitle>
                      <CardDescription className="mt-1">
                        Coordenador: {selectedCoord.coordenador?.nome || "Não definido"}
                      </CardDescription>
                      {selectedCoord.coordenador && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-sm text-muted-foreground">
                          {selectedCoord.coordenador.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              <span className="truncate max-w-[200px]">{selectedCoord.coordenador.email}</span>
                            </span>
                          )}
                          {selectedCoord.coordenador.telefone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {selectedCoord.coordenador.telefone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Editar
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Team Members */}
            <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-serif text-lg">Membros da Equipe</CardTitle>
                  <Button size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Adicionar</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {selectedCoord.membros.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum membro cadastrado nesta coordenação
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCoord.membros.map((member: any) => (
                      <div 
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-secondary text-secondary-foreground">
                              {getInitials(member.usuario?.nome)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{member.usuario?.nome || "Membro"}</p>
                            <p className="text-sm text-muted-foreground">{member.cargo || "Advogado"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-semibold text-foreground">{member.processCount || 0}</p>
                            <p className="text-xs text-muted-foreground">processos</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Ver perfil</DropdownMenuItem>
                              <DropdownMenuItem>Atribuir processo</DropdownMenuItem>
                              <DropdownMenuItem>Remover da equipe</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Process Distribution */}
            {selectedCoord.membros.length > 0 && selectedCoord.processCount > 0 && (
              <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
                <CardHeader>
                  <CardTitle className="font-serif text-lg">Distribuição de Processos</CardTitle>
                  <CardDescription>
                    Visão geral da carga de trabalho da equipe
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedCoord.membros.map((member: any) => {
                      const percentage = selectedCoord.processCount > 0 
                        ? ((member.processCount || 0) / selectedCoord.processCount) * 100 
                        : 0;
                      return (
                        <div key={member.id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{member.usuario?.nome || "Membro"}</span>
                            <span className="text-sm text-muted-foreground">
                              {member.processCount || 0} ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                selectedCoord.area === "civil" && "bg-area-civil",
                                selectedCoord.area === "trabalhista" && "bg-area-trabalhista",
                                selectedCoord.area === "empresarial" && "bg-area-empresarial"
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Coordenacoes;
