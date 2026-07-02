import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MonitoramentoTermosParalelaCard } from "@/components/configuracoes/MonitoramentoTermosParalelaCard";

export default function DjenLocal() {
  return (
    <MainLayout title="DJEN Local">
      <div className="p-4 lg:p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Execução local (navegador) do motor DJEN Termos Paralela. Kurier e Pautas agora rodam apenas via servidor.
        </p>
        <Tabs defaultValue="paralela" className="w-full">
          <TabsList>
            <TabsTrigger value="paralela">DJEN Termos Paralela</TabsTrigger>
          </TabsList>
          <TabsContent value="paralela" className="mt-4">
            <MonitoramentoTermosParalelaCard />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}