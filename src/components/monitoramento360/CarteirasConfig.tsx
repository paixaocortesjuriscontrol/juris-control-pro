import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Filter, Plus, Construction } from "lucide-react";

export default function CarteirasConfig() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Carteiras de Processos
            </CardTitle>
            <CardDescription>
              Organize processos em carteiras automáticas por critérios
            </CardDescription>
          </div>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Nova Carteira
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Construction className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Em Desenvolvimento</h3>
          <p className="text-muted-foreground max-w-md">
            O módulo de carteiras automáticas está sendo desenvolvido. 
            Em breve você poderá criar carteiras baseadas em critérios como área, 
            coordenação, status, cliente e outros filtros combinados.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
