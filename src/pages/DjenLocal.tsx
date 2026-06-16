import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MonitoramentoTermosParalelaCard } from "@/components/configuracoes/MonitoramentoTermosParalelaCard";
import { MonitoramentoTermosKurierCard } from "@/components/configuracoes/MonitoramentoTermosKurierCard";
import { MonitoramentoDjetPautasCard } from "@/components/configuracoes/MonitoramentoDjetPautasCard";

export default function DjenLocal() {
  return (
    <MainLayout title="DJEN Local">
      <div className="p-4 lg:p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Execução local (navegador) dos motores DJEN/DJET.
        </p>
        <Tabs defaultValue="paralela" className="w-full">
          <TabsList>
            <TabsTrigger value="paralela">DJEN Termos Paralela</TabsTrigger>
            <TabsTrigger value="kurier">DJEN Termos Kurier</TabsTrigger>
            <TabsTrigger value="pautas">DJET Pautas Paralela</TabsTrigger>
          </TabsList>
          <TabsContent value="paralela" className="mt-4">
            <MonitoramentoTermosParalelaCard />
          </TabsContent>
          <TabsContent value="kurier" className="mt-4">
            <MonitoramentoTermosKurierCard />
          </TabsContent>
          <TabsContent value="pautas" className="mt-4">
            <MonitoramentoDjetPautasCard />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}