import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { AudienciaFormSimplificado } from "./AudienciaFormSimplificado";

interface CadastroAudienciaFormProps {
  defaultProcessoNumero?: string;
}

export function CadastroAudienciaForm({ defaultProcessoNumero }: CadastroAudienciaFormProps = {}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Cadastrar Nova Audiência
        </CardTitle>
        <CardDescription>
          Preencha os dados essenciais da audiência
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AudienciaFormSimplificado
          defaultProcessoNumero={defaultProcessoNumero}
          hideTitleHeader
        />
      </CardContent>
    </Card>
  );
}
