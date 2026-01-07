import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function CronJobsStatusCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Configurar Cron Jobs
        </CardTitle>
        <CardDescription>
          Agendamento automático dos monitoramentos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuração Manual Necessária</AlertTitle>
          <AlertDescription>
            <p className="mb-3">
              Os cron jobs para execução automática devem ser configurados no SQL Editor do Supabase Dashboard.
            </p>
            <div className="bg-muted p-3 rounded-lg text-xs font-mono mb-3 max-h-48 overflow-y-auto">
              <p className="font-bold mb-2">Jobs Necessários:</p>
              <ul className="space-y-1">
                <li>• monitorar-redistribuicoes-tarde (18h BRT)</li>
                <li>• monitorar-andamentos-08h, 12h, 14h, 18h, 22h</li>
                <li>• monitorar-termos-manha (08h BRT)</li>
                <li>• monitorar-termos-tarde (18h BRT)</li>
              </ul>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a 
                href="/scripts/setup-cron-jobs-monitoramento.sql" 
                target="_blank"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Baixar Script SQL
              </a>
            </Button>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
