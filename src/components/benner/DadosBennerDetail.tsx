import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DadoBenner, DadoBennerInsert } from "@/hooks/useDadosBenner";
import { DadosBennerForm } from "./DadosBennerForm";
import { DadosBennerDistribuicaoTab } from "./DadosBennerDistribuicaoTab";
import { DadosBennerPautasTab } from "./DadosBennerPautasTab";
import { DadosBennerProcessoTab } from "./DadosBennerProcessoTab";

interface Props {
  dado: DadoBenner;
  onSave: (dado: DadoBennerInsert, id?: string) => Promise<boolean>;
  onCancel: () => void;
}

export function DadosBennerDetail({ dado, onSave, onCancel }: Props) {
  const processoNumero = dado.processo || "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <h2 className="text-lg font-semibold text-foreground">
          {processoNumero ? `Processo: ${processoNumero}` : `Dossiê: ${dado.dossie || "Sem identificação"}`}
        </h2>
      </div>

      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="dados">Dados Carga Benner</TabsTrigger>
          <TabsTrigger value="processo">Dados do Processo</TabsTrigger>
          <TabsTrigger value="distribuicao">Distribuição</TabsTrigger>
          <TabsTrigger value="pautas">Pautas</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <DadosBennerForm
            dado={dado}
            onSave={onSave}
            onCancel={onCancel}
          />
        </TabsContent>

        <TabsContent value="processo" className="mt-4">
          <DadosBennerProcessoTab processoNumero={processoNumero} />
        </TabsContent>

        <TabsContent value="distribuicao" className="mt-4">
          <DadosBennerDistribuicaoTab processoNumero={processoNumero} />
        </TabsContent>

        <TabsContent value="pautas" className="mt-4">
          <DadosBennerPautasTab processoNumero={processoNumero} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
