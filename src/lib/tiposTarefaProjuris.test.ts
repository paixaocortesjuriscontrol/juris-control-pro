import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { montarModelosTarefaProjuris } from "./tiposTarefaProjuris";
import { lerCsvPontoVirgula } from "./checklistProjuris";

test("só ativos não excluídos; compromisso vira evento; prazos mapeados", () => {
  const r = montarModelosTarefaProjuris([
    { cdtarefatipo: "1", flativo: "S", dtexclusao: "", nmtarefatipo: "DEFESA", nuprazopadrao: "14", nuprazofatal: "15", cdtarefaprazotipo: "4", hrpadrao: "10:30:00", fltarefacompromissotipo: "TAREFA", decor: "#2196F3" },
    { cdtarefatipo: "2", flativo: "S", dtexclusao: "", nmtarefatipo: "Providência", fltarefacompromissotipo: "COMPROMISSO" },
    { cdtarefatipo: "3", flativo: "N", dtexclusao: "", nmtarefatipo: "VELHO" },
    { cdtarefatipo: "4", flativo: "S", dtexclusao: "2024-01-01", nmtarefatipo: "EXCLUIDO" },
    { cdtarefatipo: "5", flativo: "S", dtexclusao: "", nmtarefatipo: "CORRIDO", nuprazopadrao: "5", nuprazofatal: "5", cdtarefaprazotipo: "1" },
  ]);
  assert.equal(r.length, 3);
  assert.deepEqual(r[0].padroes, { projuris_cd: "1", prazo_dias: "14", prazo_unidade: "uteis", data_fatal: "+15du", hora_prevista: "10:30", cor: "#2196F3" });
  assert.equal(r[1].tipo, "evento");
  assert.equal(r[2].padroes.data_fatal, "+5d");
});

test("planilha enviada tem 212 tipos ativos", () => {
  const f = "/mnt/user-uploads/tarefatipo-4.csv";
  if (!existsSync(f)) return;
  assert.equal(montarModelosTarefaProjuris(lerCsvPontoVirgula(readFileSync(f, "utf8"))).length, 212);
});
