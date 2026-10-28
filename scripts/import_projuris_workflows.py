"""Prepare a reviewed, non-executing Projuris template import; never connects to DB."""
import csv
import json
from pathlib import Path


def read_csv(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file, delimiter=";"))


def prepare(folder):
    folder = Path(folder)
    workflows = read_csv(folder / "workflow-2.csv")
    stages = read_csv(folder / "etapaworkflow-2.csv")
    tasks = {r["cdetapaworkflow"]: r for r in read_csv(folder / "etapaworkflowtarefa-2.csv")}
    types = {r["cdtarefatipo"]: r for r in read_csv(folder / "tarefatipo-3.csv")}
    result = []
    for workflow in workflows:
        if workflow["cdworkfloworiginal"] or workflow["flativo"] != "t" or workflow["flhabilitado"] != "t":
            continue
        selected = [s for s in stages if s["cdworkflow"] == workflow["cdworkflow"] and s["cdversao"] == workflow["cdversao"]]
        ordered = []
        pending = list(selected)
        while pending:
            ready = sorted([s for s in pending if not s["cdetapaworkflowanterior"] or s["cdetapaworkflowanterior"] in {x["cdetapaworkflow"] for x in ordered}], key=lambda s: int(s["cdetapaworkflow"]))
            if not ready:
                raise ValueError("Missing predecessor or cycle")
            for stage in ready:
                ordered.append(stage)
                pending.remove(stage)
        rows = []
        for stage in ordered:
            task = tasks[stage["cdetapaworkflow"]]
            task_type = types[task["cdtarefatipo"]]
            inherit = task["flusadadostarefatipo"] == "t"
            def value(stage_key, type_key):
                return task_type[type_key] if inherit else task[stage_key]
            deadline_type = value("cdtarefaprazotipo", "cdtarefaprazotipo")
            if deadline_type not in ("1", "4"):
                raise ValueError("Unsupported deadline rule")
            condition = json.loads(stage["flcondicaoinicio"])
            if condition not in ({}, {"situacao": 2}):
                raise ValueError("Unsupported branch condition")
            if stage["flacaoinicio"] != "CRIAR_TAREFA" or task_type["fltarefacompromissotipo"] != "TAREFA":
                raise ValueError("Unsupported action or task kind")
            rows.append({
                "source": stage["cdetapaworkflow"], "previous": stage["cdetapaworkflowanterior"] or None,
                "title": stage["detitulo"] or task_type["nmtarefatipo"],
                "days": int(value("nuprazoprevisto", "nuprazopadrao") or 0),
                "fatal": int(value("nuprazofatal", "nuprazofatal") or 0),
                "unit": "dias_uteis" if deadline_type == "4" else "dias_corridos",
                "condition": "sucesso_anterior" if condition else "sempre",
                "description": stage["dedescricao"] or task_type["detarefa"] or None,
                "responsibility": value("fltipotemplateusuario", "fltipotemplateusuario"),
            })
        if not rows:
            raise ValueError("Active template without stages")
        result.append({"source": workflow["cdworkflow"], "version": workflow["cdversao"], "name": workflow["detitulo"], "stages": rows})
    return result


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("folder")
    parser.add_argument("output")
    args = parser.parse_args()
    payload = prepare(args.folder)
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Prepared {len(payload)} inactive templates, {sum(len(w['stages']) for w in payload)} stages; no database writes.")