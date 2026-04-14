import {
  classificarMovimento,
  MovimentoBruto,
} from "./classificador.ts";
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// ── Decisões recorríveis ──

Deno.test("Acórdão por código 385 → eh_decisao_recorrivel", () => {
  const mov: MovimentoBruto = { codigo: "385", descricao: "Publicação do acórdão", data: "2024-06-01" };
  const r = classificarMovimento(mov);
  assertEquals(r.eh_decisao_recorrivel, true);
  assertEquals(r.eh_recurso_interposto, false);
  assertEquals(r.eh_certidao_transito, false);
});

Deno.test("Decisão monocrática por texto → eh_decisao_recorrivel", () => {
  const mov: MovimentoBruto = { codigo: null, descricao: "Proferida decisão monocrática negando provimento", data: "2024-07-01" };
  const r = classificarMovimento(mov);
  assertEquals(r.eh_decisao_recorrivel, true);
});

Deno.test("Sentença publicada → eh_decisao_recorrivel", () => {
  const mov: MovimentoBruto = { codigo: "472", descricao: "Sentença publicada em audiência", data: "2024-03-15" };
  const r = classificarMovimento(mov);
  assertEquals(r.eh_decisao_recorrivel, true);
});

// ── Recursos interpostos ──

Deno.test("Recurso de Revista por texto → eh_recurso_interposto", () => {
  const mov: MovimentoBruto = { codigo: null, descricao: "Interposição de Recurso de Revista pela reclamada", data: "2024-07-10" };
  const r = classificarMovimento(mov);
  assertEquals(r.eh_recurso_interposto, true);
});

Deno.test("Embargos de declaração → eh_recurso_interposto", () => {
  const mov: MovimentoBruto = { codigo: "119", descricao: "Embargos de declaração opostos", data: "2024-08-01" };
  const r = classificarMovimento(mov);
  assertEquals(r.eh_recurso_interposto, true);
});

// ── Certidão de trânsito ──

Deno.test("Certidão de trânsito código 848 + texto → eh_certidao_transito", () => {
  const mov: MovimentoBruto = { codigo: "848", descricao: "Certidão de trânsito em julgado expedida", data: "2024-09-01" };
  const r = classificarMovimento(mov);
  assertEquals(r.eh_certidao_transito, true);
});

Deno.test("Trânsito em julgado apenas por texto → eh_certidao_transito", () => {
  const mov: MovimentoBruto = { codigo: null, descricao: "Certifico o trânsito em julgado nesta data", data: "2024-09-15" };
  const r = classificarMovimento(mov);
  assertEquals(r.eh_certidao_transito, true);
});

// ── Casos negativos ──

Deno.test("Juntada de petição → nenhum flag", () => {
  const mov: MovimentoBruto = { codigo: "581", descricao: "Juntada de petição inicial", data: "2024-01-10" };
  const r = classificarMovimento(mov);
  assertEquals(r.eh_decisao_recorrivel, false);
  assertEquals(r.eh_recurso_interposto, false);
  assertEquals(r.eh_certidao_transito, false);
});

Deno.test("Conclusão ao juiz → nenhum flag", () => {
  const mov: MovimentoBruto = { codigo: "51", descricao: "Conclusos os autos ao juiz", data: "2024-02-20" };
  const r = classificarMovimento(mov);
  assertEquals(r.eh_decisao_recorrivel, false);
  assertEquals(r.eh_recurso_interposto, false);
  assertEquals(r.eh_certidao_transito, false);
});

Deno.test("Expedição de ofício → nenhum flag", () => {
  const mov: MovimentoBruto = { codigo: "60", descricao: "Expedição de ofício ao INSS para informações", data: "2024-04-05" };
  const r = classificarMovimento(mov);
  assertEquals(r.eh_decisao_recorrivel, false);
  assertEquals(r.eh_recurso_interposto, false);
  assertEquals(r.eh_certidao_transito, false);
});
