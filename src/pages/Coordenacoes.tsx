import { useState } from "react";
import { Plus, Users, Briefcase, MoreVertical, Mail, Phone } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

const coordenacoes = [
  {
    id: "1",
    name: "Coordenação Cível",
    area: "civil" as const,
    coordinator: {
      name: "Dr. Carlos Paixão",
      email: "carlos.paixao@paixaocortes.adv.br",
      phone: "(21) 99999-0001",
      initials: "CP",
    },
    processCount: 127,
    teamMembers: [
      { id: "1", name: "Ana Silva", role: "Advogada Plena", initials: "AS", processCount: 32 },
      { id: "2", name: "Bruno Costa", role: "Advogado Jr.", initials: "BC", processCount: 18 },
      { id: "3", name: "Carla Dias", role: "Advogada Plena", initials: "CD", processCount: 28 },
      { id: "4", name: "Daniel Lima", role: "Estagiário", initials: "DL", processCount: 12 },
      { id: "5", name: "Eva Santos", role: "Advogada Sênior", initials: "ES", processCount: 37 },
    ],
  },
  {
    id: "2",
    name: "Coordenação Trabalhista",
    area: "trabalhista" as const,
    coordinator: {
      name: "Dra. Marina Cortes",
      email: "marina.cortes@paixaocortes.adv.br",
      phone: "(21) 99999-0002",
      initials: "MC",
    },
    processCount: 89,
    teamMembers: [
      { id: "6", name: "Felipe Rocha", role: "Advogado Pleno", initials: "FR", processCount: 29 },
      { id: "7", name: "Gabriela Nunes", role: "Advogada Jr.", initials: "GN", processCount: 22 },
      { id: "8", name: "Hugo Pereira", role: "Advogado Sênior", initials: "HP", processCount: 38 },
    ],
  },
  {
    id: "3",
    name: "Coordenação Empresarial",
    area: "empresarial" as const,
    coordinator: {
      name: "Dr. Ricardo Alves",
      email: "ricardo.alves@paixaocortes.adv.br",
      phone: "(21) 99999-0003",
      initials: "RA",
    },
    processCount: 54,
    teamMembers: [
      { id: "9", name: "Isabela Melo", role: "Advogada Plena", initials: "IM", processCount: 15 },
      { id: "10", name: "João Pedro", role: "Advogado Jr.", initials: "JP", processCount: 11 },
      { id: "11", name: "Karen Souza", role: "Advogada Sênior", initials: "KS", processCount: 18 },
      { id: "12", name: "Lucas Ferreira", role: "Estagiário", initials: "LF", processCount: 10 },
    ],
  },
];

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
  const [selectedCoord, setSelectedCoord] = useState(coordenacoes[0]);

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
              Nova
            </Button>
          </div>

          {coordenacoes.map((coord, index) => (
            <Card 
              key={coord.id}
              className={cn(
                "cursor-pointer transition-all border-l-4 hover:shadow-medium animate-slide-up",
                areaColors[coord.area],
                selectedCoord.id === coord.id && "ring-2 ring-primary/20"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => setSelectedCoord(coord)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{coord.name}</h3>
                    <p className="text-sm text-muted-foreground">{coord.coordinator.name}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {areaLabels[coord.area]}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Briefcase className="w-4 h-4" />
                    <span className="font-medium text-foreground">{coord.processCount}</span> processos
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="font-medium text-foreground">{coord.teamMembers.length}</span> membros
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Selected Coordination Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Coordinator Info */}
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                      {selectedCoord.coordinator.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="font-serif">{selectedCoord.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Coordenador: {selectedCoord.coordinator.name}
                    </CardDescription>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {selectedCoord.coordinator.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {selectedCoord.coordinator.phone}
                      </span>
                    </div>
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
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedCoord.teamMembers.map((member) => (
                  <div 
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-foreground">{member.processCount}</p>
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
            </CardContent>
          </Card>

          {/* Process Distribution */}
          <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Distribuição de Processos</CardTitle>
              <CardDescription>
                Visão geral da carga de trabalho da equipe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedCoord.teamMembers.map((member) => {
                  const percentage = (member.processCount / selectedCoord.processCount) * 100;
                  return (
                    <div key={member.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{member.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {member.processCount} ({percentage.toFixed(0)}%)
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
        </div>
      </div>
    </MainLayout>
  );
};

export default Coordenacoes;
