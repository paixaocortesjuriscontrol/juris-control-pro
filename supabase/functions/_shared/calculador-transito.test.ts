import {
  calcularStatusTransito,
  MovimentacaoClassificada,
  adicionarDiasUteis,
} from "./calculador-transito.ts";
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

function mov(
  data: string,
  opts: Partial<MovimentacaoClassificada> = {}
): MovimentacaoClassificada {
  return {
    data,
    descricao: opts.descricao || "Movimento genérico",
    codigo: opts.codigo || null,
    eh_decisao_recorrivel: opts.eh_decisao_recorrivel || false,
    eh_recurso_interposto: opts.eh_recurso_interposto || false,
    eh_certidao_transito: opts.eh_certidao_transito || false,
  };
}

// ── 1. Certidão de trânsito explícita → transitado_confirmado ──
Deno.test("Certidão de trânsito → transitado_confirmado", () => {
  const movs = [
    mov("2024-01-10", { eh_decisao_recorrivel: true, descricao: "Acórdão" }),
    mov("2024-06-01", { eh_certidao_transito: true, descricao: "Certidão de trânsito" }),
  ];
  const r = calcularStatusTransito(movs, { tribunal_origem: "TRT2", hoje: new Date("2024-09-01") });
  assertEquals(r.status, "transitado_confirmado");
  assertEquals(r.data_transito_estimada, "2024-06-01");
});

// ── 2. Acórdão há 30 dias sem recurso → transitado_provavel ──
Deno.test("Acórdão há 30 dias sem recurso → transitado_provavel", () => {
  const movs = [
    mov("2024-06-01", { eh_decisao_recorrivel: true, descricao: "Acórdão publicado" }),
  ];
  const r = calcularStatusTransito(movs, { tribunal_origem: "TRT2", hoje: new Date("2024-07-15") });
  assertEquals(r.status, "transitado_provavel");
});

// ── 3. Acórdão há 5 dias úteis sem recurso → em_curso (dentro do prazo) ──
Deno.test("Acórdão há 5 dias úteis → em_curso", () => {
  const movs = [
    mov("2024-06-03", { eh_decisao_recorrivel: true, descricao: "Acórdão publicado" }), // segunda
  ];
  // 5 dias úteis depois = 10/06/2024 (segunda). Prazo = 8 dias úteis = 13/06/2024 (quinta)
  const r = calcularStatusTransito(movs, { tribunal_origem: "TRT2", hoje: new Date("2024-06-10") });
  assertEquals(r.status, "em_curso");
});

// ── 4. Acórdão seguido de RR no prazo → em_curso ──
Deno.test("Acórdão + RR no prazo → em_curso", () => {
  const movs = [
    mov("2024-06-03", { eh_decisao_recorrivel: true, descricao: "Acórdão" }),
    mov("2024-06-10", { eh_recurso_interposto: true, descricao: "Recurso de Revista" }),
  ];
  const r = calcularStatusTransito(movs, { tribunal_origem: "TRT2", hoje: new Date("2024-08-01") });
  assertEquals(r.status, "em_curso");
});

// ── 5. Acórdão + RR FORA do prazo → transitado_provavel (intempestivo) ──
Deno.test("Recurso intempestivo → transitado_provavel", () => {
  const movs = [
    mov("2024-06-03", { eh_decisao_recorrivel: true, descricao: "Acórdão" }),
    mov("2024-07-20", { eh_recurso_interposto: true, descricao: "Recurso de Revista" }),
  ];
  const r = calcularStatusTransito(movs, { tribunal_origem: "TRT2", hoje: new Date("2024-08-01") });
  assertEquals(r.status, "transitado_provavel");
  assertEquals(r.justificativa.includes("intempestivo"), true);
});

// ── 6. Decisão em 18/12, prazo cai no recesso → empurrado para após 20/01 ──
Deno.test("Prazo no recesso → empurrado para pós-recesso", () => {
  const movs = [
    mov("2024-12-18", { eh_decisao_recorrivel: true, descricao: "Acórdão" }),
  ];
  // 8 dias úteis a partir de 18/12/2024. Recesso 20/12-20/01.
  // Dias úteis: 19/12 (1), depois pula para 21/01 (2), 22/01 (3), ...
  const r = calcularStatusTransito(movs, { tribunal_origem: "TRT2", hoje: new Date("2025-02-15") });
  assertEquals(r.status, "transitado_provavel");
  // O prazo deve cair depois de 20/01/2025
  const dataTransito = r.data_transito_estimada!;
  assertEquals(dataTransito >= "2025-01-28", true); // pelo menos 28/01 (7 dias úteis após 21/01)
});

// ── 7. Sem decisão recorrível → em_curso ──
Deno.test("Sem decisão recorrível → em_curso", () => {
  const movs = [
    mov("2024-01-10", { descricao: "Juntada de petição" }),
    mov("2024-02-20", { descricao: "Conclusos ao juiz" }),
  ];
  const r = calcularStatusTransito(movs, { tribunal_origem: "TRT2", hoje: new Date("2024-09-01") });
  assertEquals(r.status, "em_curso");
  assertEquals(r.justificativa.includes("Sem decisão recorrível"), true);
});
