"""erd.json: entities with fields, resolved relations, and accesses aggregated to files."""

from __future__ import annotations

from collections import defaultdict
from pathlib import PurePosixPath

from ..ir import path_of
from ..resolve import Resolved


def build_erd(header: dict, resolved: Resolved) -> tuple[dict, dict]:
    fields_by: dict[str, list[dict]] = defaultdict(list)
    for fld in resolved.fields:
        fields_by[fld["entity"]].append(fld)
    relations = [r for r in resolved.relations if r["dst"]]
    accesses = [a for a in resolved.accesses if a["target"]]
    related: set[str] = set()
    for rel in relations:
        related.update((rel["src"], rel["dst"]))
    targeted = {a["target"] for a in accesses}
    typed_by_line: dict[tuple[str, int], str] = {}
    for rel in relations:
        source = rel["origin"].get("source")
        if rel["kind"] == "has_field_of" and source:
            typed_by_line.setdefault((rel["src"], source["line"]), rel["dst"])

    entities = []
    omitted = 0
    data_kinds = {"table", "file_store", "config", "dataclass", "pydantic", "typeddict", "enum", "global"}
    for entity in resolved.entities:
        eid = entity["id"]
        own_fields = fields_by.get(eid, [])
        if not own_fields and eid not in related and eid not in targeted and entity["kind"] not in (*data_kinds, "class", "interface", "type"):
            omitted += 1
            continue
        fields = []
        # `x: T` in the class body and `self.x = …` in __init__ name one field; keep the typed, extracted one.
        best: dict[str, dict] = {}
        for fld in own_fields:
            prior = best.get(fld["name"])
            rank = (fld["type_ref"] is not None, fld["origin"]["provenance"] == "extracted")
            if prior is None or rank > (prior["type_ref"] is not None, prior["origin"]["provenance"] == "extracted"):
                best[fld["name"]] = fld
        own_fields = [f for f in own_fields if best[f["name"]] is f]
        for fld in own_fields:
            source = fld["origin"].get("source")
            type_id = fld.get("type_id") or (typed_by_line.get((eid, source["line"])) if source else None)
            fields.append({"name": fld["name"], "type_ref": fld["type_ref"], "type_id": type_id,
                           "provenance": fld["origin"]["provenance"]})
        path = path_of(eid)
        file_name = PurePosixPath(path).name if path else ""
        is_test = bool(path and (
            "tests" in PurePosixPath(path).parts[:-1]
            or file_name in ("conftest.py",)
            or file_name.startswith("test_") and file_name.endswith(".py")
            or file_name.endswith(("_test.py", ".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"))
        ))
        is_data = entity["kind"] in data_kinds or (entity["kind"] in ("class", "interface", "type") and bool(own_fields))
        entities.append({
            "id": eid,
            "kind": entity["kind"],
            "name": entity["name"],
            "path": path,
            "layer": "data" if is_data else "code",
            "test": is_test,
            "fields": fields,
            "source": entity["origin"].get("source"),
            "provenance": entity["origin"]["provenance"],
        })

    agg: dict[tuple[str, str, str], dict] = {}
    for acc in accesses:
        actor_file = path_of(acc["actor"]) or acc["actor"]
        key = (actor_file, acc["target"], acc["mode"])
        row = agg.setdefault(key, {"actor_file": actor_file, "target": acc["target"], "mode": acc["mode"], "count": 0,
                                   "provenance": "extracted", "functions": []})
        row["count"] += 1
        if acc["provenance"] == "inferred":
            row["provenance"] = "inferred"
        source = acc["origin"].get("source")
        row["functions"].append({"actor": acc["actor"], "provenance": acc["provenance"],
                                 "line": source["line"] if source else None, "target_ref": acc["target_ref"]})
    view = {
        **header,
        "entities": entities,
        "relations": sorted(
            ({"src": r["src"], "dst": r["dst"], "dst_ref": r["dst_ref"], "kind": r["kind"], "provenance": r["provenance"]}
             for r in relations),
            key=lambda r: (r["src"], r["kind"], r["dst"]),
        ),
        "accesses": sorted(agg.values(), key=lambda a: (a["actor_file"], a["target"], a["mode"])),
    }
    stats = {"entities": len(entities), "omitted": omitted, "relations": len(relations), "accesses": len(accesses),
             "access_edges": len(agg)}
    return view, stats
