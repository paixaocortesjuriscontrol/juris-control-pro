import { describe, expect, spyOn, test } from "bun:test";
import { supabase } from "../src/integrations/supabase/client";
import { criarItemWorkflow, type WorkflowEtapa } from "../src/lib/workflowExecutor";

describe("Processo nas etapas automáticas do workflow", () => {
  test("audiência seguinte busca o número pelo processo vinculado", async () => {
    const numero = "0001234-56.2026.5.02.0001";
    let audienciaInserida: any = null;
    const authSpy = spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as any);
    const fromSpy = spyOn(supabase, "from").mockImplementation(((tabela: string) => {
      const query: any = {
        select() { return query; },
        eq() { return query; },
        order() { return query; },
        async maybeSingle() {
          return tabela === "processos"
            ? { data: { numero }, error: null }
            : { data: null, error: null };
        },
        insert(payload: any) {
          if (tabela === "audiencias_detectadas") audienciaInserida = payload;
          return query;
        },
        then(resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return query;
    }) as any);

    const etapa: WorkflowEtapa = {
      id: "etapa-2",
      workflow_id: "workflow-1",
      ordem: 2,
      titulo: "Audiência de conciliação",
      tipo_item: "AUDIENCIA",
      tipo_prazo: "dias_corridos",
      dias_previsto: 0,
      dias_fatal: null,
      prioridade: "media",
      descricao: null,
      exibir_kanban: false,
      regra_responsavel: "predefinido",
      condicao: "sempre",
      campos_item: { data_audiencia: "2026-11-20", hora: "10:00" },
    };

    try {
      await criarItemWorkflow(
        { id: "exec-1", iniciado_por: "user-1", coordenacao_id: "" } as any,
        etapa,
        new Date("2026-11-18T12:00:00-03:00"),
        null,
        "proc-1"
      );
      expect(audienciaInserida?.processo_id).toBe("proc-1");
      expect(audienciaInserida?.processo_numero).toBe(numero);
    } finally {
      authSpy.mockRestore();
      fromSpy.mockRestore();
    }
  });
});
