import { useState } from "react";
import { Filter, Calendar, User, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FiltrosAvancados {
  tipo: "processo" | "todos";
  comMovimento: boolean;
  periodoInicio?: Date;
  periodoFim?: Date;
  responsavelId?: string;
  responsavelNome?: string;
  instancia: "1" | "2" | "superior" | "todos";
}

interface FiltrosAvancadosProcessosProps {
  filtros: FiltrosAvancados;
  onFiltrosChange: (filtros: FiltrosAvancados) => void;
  onAplicar: () => void;
  onLimpar: () => void;
  coordenacaoId?: string;
}

export const defaultFiltrosAvancados: FiltrosAvancados = {
  tipo: "todos",
  comMovimento: false,
  instancia: "todos",
};

export function FiltrosAvancadosProcessos({
  filtros,
  onFiltrosChange,
  onAplicar,
  onLimpar,
  coordenacaoId,
}: FiltrosAvancadosProcessosProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [responsavelSearch, setResponsavelSearch] = useState("");

  // Fetch members of the selected coordination OR all profiles if no coordination selected
  const { data: advogados = [] } = useQuery({
    queryKey: ["profiles-select", coordenacaoId],
    queryFn: async () => {
      if (coordenacaoId && coordenacaoId !== "all") {
        // Fetch only members of the selected coordination
        const { data: membros, error: membrosError } = await supabase
          .from("membros_coordenacao")
          .select("usuario_id, profiles:profiles_basic!inner(id, nome)")
          .eq("coordenacao_id", coordenacaoId);
        
        if (membrosError) throw membrosError;
        
        return (membros || [])
          .map((m: any) => m.profiles)
          .filter((p: any) => p?.id && p?.nome)
          .sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || ""));
      } else {
        // Fetch all profiles
        const { data, error } = await supabase
          .from("profiles_basic")
          .select("id, nome")
          .order("nome");
        if (error) throw error;
        return data;
      }
    },
  });

  const filteredAdvogados = advogados.filter((a: any) =>
    a.nome?.toLowerCase().includes(responsavelSearch.toLowerCase())
  );

  const hasActiveFilters =
    filtros.tipo !== "todos" ||
    filtros.comMovimento ||
    filtros.periodoInicio ||
    filtros.periodoFim ||
    filtros.responsavelId ||
    filtros.instancia !== "todos";

  const handleResponsavelSelect = (id: string, nome: string) => {
    onFiltrosChange({ ...filtros, responsavelId: id, responsavelNome: nome });
    setResponsavelSearch("");
  };

  const handleClearResponsavel = () => {
    onFiltrosChange({ ...filtros, responsavelId: undefined, responsavelNome: undefined });
  };

  return (
    <div className="relative">
      {/* Trigger Row - Always visible */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {/* Com Movimento Toggle */}
        <Button
          variant={filtros.comMovimento ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs font-medium"
          onClick={() => onFiltrosChange({ ...filtros, comMovimento: !filtros.comMovimento })}
        >
          COM MOVIMENTO
        </Button>

        {/* Período */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
              <Calendar className="w-3 h-3" />
              {filtros.periodoInicio || filtros.periodoFim
                ? `${filtros.periodoInicio ? format(filtros.periodoInicio, "dd/MM/yy") : "..."} - ${filtros.periodoFim ? format(filtros.periodoFim, "dd/MM/yy") : "..."}`
                : "Defina o período"}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Data inicial</Label>
                <CalendarComponent
                  mode="single"
                  selected={filtros.periodoInicio}
                  onSelect={(date) => onFiltrosChange({ ...filtros, periodoInicio: date })}
                  locale={ptBR}
                  className="rounded-md border"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data final</Label>
                <CalendarComponent
                  mode="single"
                  selected={filtros.periodoFim}
                  onSelect={(date) => onFiltrosChange({ ...filtros, periodoFim: date })}
                  locale={ptBR}
                  className="rounded-md border"
                />
              </div>
              {(filtros.periodoInicio || filtros.periodoFim) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFiltrosChange({ ...filtros, periodoInicio: undefined, periodoFim: undefined })}
                >
                  Limpar período
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Responsável */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 max-w-[200px]">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {filtros.responsavelNome || "RESPONSÁVEL"}
              </span>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-2">
              <Input
                placeholder="Digite o nome do responsável"
                value={responsavelSearch}
                onChange={(e) => setResponsavelSearch(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredAdvogados.slice(0, 20).map((adv) => (
                  <button
                    key={adv.id}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors",
                      filtros.responsavelId === adv.id && "bg-accent"
                    )}
                    onClick={() => handleResponsavelSelect(adv.id!, adv.nome!)}
                  >
                    {adv.nome}
                  </button>
                ))}
              </div>
              {filtros.responsavelId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={handleClearResponsavel}
                >
                  Limpar seleção
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Mais Filtros Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 text-xs gap-1", isOpen && "bg-accent")}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Filter className="w-3 h-3" />
          Mais Filtros
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
              !
            </Badge>
          )}
        </Button>
      </div>

      {/* Expanded Filters Panel */}
      {isOpen && (
        <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border/50 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Tipo */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">Tipo:</Label>
              <RadioGroup
                value={filtros.tipo}
                onValueChange={(val) => onFiltrosChange({ ...filtros, tipo: val as "processo" | "todos" })}
                className="flex flex-col gap-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="processo" id="tipo-processo" />
                  <Label htmlFor="tipo-processo" className="text-sm font-normal cursor-pointer">Processo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="todos" id="tipo-todos" />
                  <Label htmlFor="tipo-todos" className="text-sm font-normal cursor-pointer">Todos</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Grau do Processo */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">Grau do processo:</Label>
              <RadioGroup
                value={filtros.instancia}
                onValueChange={(val) => onFiltrosChange({ ...filtros, instancia: val as "1" | "2" | "superior" | "todos" })}
                className="flex flex-col gap-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1" id="inst-1" />
                  <Label htmlFor="inst-1" className="text-sm font-normal cursor-pointer">1º Grau</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="2" id="inst-2" />
                  <Label htmlFor="inst-2" className="text-sm font-normal cursor-pointer">2º Grau</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="superior" id="inst-sup" />
                  <Label htmlFor="inst-sup" className="text-sm font-normal cursor-pointer">Superior</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="todos" id="inst-todos" />
                  <Label htmlFor="inst-todos" className="text-sm font-normal cursor-pointer">Todos</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onLimpar();
                setIsOpen(false);
              }}
            >
              CANCELAR
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onAplicar();
                setIsOpen(false);
              }}
            >
              APLICAR
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
