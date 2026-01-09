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
              Os cron jobs para execução completa automática devem ser configurados no SQL Editor do Supabase Dashboard.
            </p>
            <div className="bg-muted p-3 rounded-lg text-xs font-mono mb-3 max-h-48 overflow-y-auto">
              <p className="font-bold mb-2">Jobs de Execução Completa (2x/dia):</p>
              <ul className="space-y-1">
                <li>• <strong>Andamentos:</strong> 08h e 18h BRT</li>
                <li>• <strong>DJEN Termos:</strong> 08h e 18h BRT</li>
                <li>• <strong>DJEN Processos:</strong> 09h e 19h BRT</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a 
                  href="/scripts/setup-cron-jobs-completos.sql" 
                  target="_blank"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Baixar Script SQL
                </a>
              </Button>
              <Button variant="default" size="sm" asChild>
                <a 
                  href="https://supabase.com/dashboard/project/bfxahrrvoqxcdmfsvnrk/sql/new" 
                  target="_blank"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir SQL Editor
                </a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
