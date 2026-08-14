import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowList } from "@/components/workflow/WorkflowList";
import { WorkflowEditor } from "@/components/workflow/WorkflowEditor";
import { WorkflowExecucoesList } from "@/components/workflow/WorkflowExecucoesList";

export default function Workflow() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  return (
    <MainLayout title="Workflows">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
            <p className="text-sm text-muted-foreground">
              Fluxos de trabalho com etapas dependentes por coordenação.
            </p>
          </div>
        </div>

        <Tabs defaultValue="fluxos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="fluxos">Fluxos</TabsTrigger>
            <TabsTrigger value="execucoes">Execuções</TabsTrigger>
          </TabsList>
          <TabsContent value="fluxos" className="space-y-4">
            {selectedWorkflowId ? (
              <WorkflowEditor
                workflowId={selectedWorkflowId}
                onBack={() => setSelectedWorkflowId(null)}
              />
            ) : (
              <WorkflowList
                onSelect={setSelectedWorkflowId}
                onIniciar={(id) => setSelectedWorkflowId(id)}
              />
            )}
          </TabsContent>
          <TabsContent value="execucoes" className="space-y-4">
            <WorkflowExecucoesList />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
