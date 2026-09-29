"""Language-agnostic reference resolution (§4.4)."""

from __future__ import annotations

import posixpath
import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from .context import ProjectConfig
from .ir import Access, Diagnostic, Entity, Field, Origin, Relation, id_form, module_of, path_of, to_dict
from .walk import any_match

TAG = "resolve@1"
_IDENTLIKE = re.compile(r"^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$")


@dataclass
class Resolved:
    entities: list[dict] = field(default_factory=list)
    fields: list[dict] = field(default_factory=list)
    relations: list[dict] = field(default_factory=list)
    accesses: list[dict] = field(default_factory=list)
    diagnostics: list[Diagnostic] = field(default_factory=list)
    stats: dict = field(default_factory=dict)


def _lang(identifier: str) -> str | None:
    return identifier.split(":", 1)[0] if id_form(identifier) in ("module", "symbol") else None


def _dir(identifier: str) -> list[str]:
    path = path_of(identifier) or ""
    return posixpath.dirname(path).split("/") if path else []


def _closeness(a: list[str], b: list[str]) -> int:
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def _combine(*provenances: str) -> str:
    return "inferred" if "inferred" in provenances else "extracted"


class SymbolTable:
    def __init__(self, entities: list[Entity]):
        self.by_id: dict[str, Entity] = {}
        self.suffix: dict[str, list[str]] = defaultdict(list)
        self.module_suffix: dict[str, list[str]] = defaultdict(list)
        self.last: dict[str, list[str]] = defaultdict(list)
        self.members: dict[str, dict[str, str]] = defaultdict(dict)  # module id → qualname → id
        self.module_names: dict[str, str] = {}
        for entity in entities:
            self.by_id.setdefault(entity.id, entity)
        for entity in self.by_id.values():
            form = id_form(entity.id)
            if form == "module":
                self.module_names[entity.id] = entity.name
        for entity in self.by_id.values():
            form = id_form(entity.id)
            if form == "module":
                parts = entity.name.split(".")
                for i in range(len(parts)):
                    self.module_suffix[".".join(parts[i:])].append(entity.id)
            elif form == "symbol":
                module, qual = entity.id.split("::", 1)
                self.members[module][qual] = entity.id
                full = f"{self.module_names.get(module, '')}.{qual}".strip(".").split(".")
                for i in range(len(full)):
                    self.suffix[".".join(full[i:])].append(entity.id)
                self.last[qual.split(".")[-1]].append(entity.id)


class Resolver:
    def __init__(self, entities: list[Entity], config: ProjectConfig):
        self.config = config
        self.table = SymbolTable(entities)
        self.implicit: dict[str, Entity] = {}
        self.diagnostics: list[Diagnostic] = []
        self.imports: dict[str, set[str]] = defaultdict(set)
        self.store_tables: dict[str, list[str]] = defaultdict(list)  # table name → store ids
        for entity in self.table.by_id.values():
            if entity.kind == "table" and entity.id.startswith("db:"):
                store, table = entity.id[3:].split("::", 1)
                self.store_tables[table].append(store)
        self.identifiers: dict[str, str] = {}
        for store in config.sqlite:
            for name in store.identifiers:
                self.identifiers[name] = f"db:{store.id}"
        for fstore in config.files:
            for name in fstore.identifiers:
                self.identifiers[name] = f"file:{fstore.id}"

    # ----------------------------------------------------------- candidates
    def _pick(self, ref: str, candidates: list[str], referrer: str, provenance: str) -> tuple[str | None, str | None]:
        candidates = sorted(set(candidates))
        lang = _lang(referrer)
        if lang:
            same = [c for c in candidates if _lang(c) == lang]
            candidates = same or ([] if any(_lang(c) for c in candidates) else candidates)
        if not candidates:
            return None, None
        if len(candidates) == 1:
            return candidates[0], provenance
        here = _dir(referrer)
        scored = sorted(candidates, key=lambda c: (-_closeness(here, _dir(c)), c))
        self.diagnostics.append(Diagnostic(
            TAG, path_of(referrer), "warning",
            f"reference {ref!r} from {referrer} has {len(candidates)} candidates; picked {scored[0]}",
        ))
        return scored[0], "inferred"

    def resolve_module(self, ref: str, referrer: str) -> tuple[str | None, str | None]:
        if ref in self.table.by_id:
            return ref, "extracted"
        dotted = ref.strip(".").replace("/", ".")
        hits = self.table.module_suffix.get(dotted, [])
        return self._pick(ref, hits, referrer, "extracted") if hits else (None, None)

    def _implicit(self, ref: str, kind: str) -> str:
        if ref not in self.table.by_id and ref not in self.implicit:
            name = ref.split(":", 2)[-1] if kind == "event" else ref.split(":", 1)[1]
            self.implicit[ref] = Entity(ref, kind, name, Origin(TAG, "extracted", None))
        return ref

    def _prefixed(self, ref: str, referrer: str) -> tuple[str | None, str | None] | None:
        if ref.startswith("event:"):
            return self._implicit(ref, "event"), "extracted"
        if ref.startswith("global:"):
            return self._implicit(ref, "global"), "extracted"
        if ref.startswith("db:?::"):
            table = ref[len("db:?::"):]
            stores = sorted(set(self.store_tables.get(table, [])))
            if len(stores) == 1:
                return f"db:{stores[0]}::{table}", "inferred"
            why = "no configured SQLite store has it" if not stores else f"{len(stores)} stores have it"
            self.diagnostics.append(Diagnostic(TAG, path_of(referrer), "warning", f"table {table!r} left unresolved: {why}"))
            return None, None
        if ref.startswith(("db:", "file:")):
            return (ref, "extracted") if ref in self.table.by_id else (None, None)
        return None

    def resolve(self, ref: str, referrer: str) -> tuple[str | None, str | None]:
        if ref in self.table.by_id:
            return ref, "extracted"
        prefixed = self._prefixed(ref, referrer)
        if prefixed is not None:
            return prefixed
        key = ref.replace("::", ".")
        if not _IDENTLIKE.match(key):
            return None, None
        hits = self.table.suffix.get(key, [])
        if len(hits) == 1:
            return self._pick(ref, hits, referrer, "extracted")
        module = module_of(referrer)
        visible = [self.table.members[m][key] for m in self.imports.get(module, ()) if key in self.table.members.get(m, {})]
        if len(set(visible)) == 1:
            return visible[0], "extracted"
        if hits:
            return self._pick(ref, hits, referrer, "inferred")
        last = self.table.last.get(key.split(".")[-1], [])
        if last:
            return self._pick(ref, last, referrer, "inferred")
        return None, None

    def resolve_target(self, ref: str, referrer: str) -> tuple[str | None, str | None]:
        """Access targets: store identifiers and file-store globs first, then the symbol path."""
        if ref in self.table.by_id:
            return ref, "extracted"
        prefixed = self._prefixed(ref, referrer)
        if prefixed is not None:
            return prefixed
        last = ref.replace("::", ".").split(".")[-1]
        for candidate in (ref, last):
            store = self.identifiers.get(candidate)
            if store and store in self.table.by_id:
                return store, "inferred"
        literal = ref.lstrip("./")
        for fstore in self.config.files:
            if any_match(fstore.globs, literal) or any(literal.endswith(g.lstrip("*/")) and "*" not in g for g in fstore.globs):
                target = f"file:{fstore.id}"
                if target in self.table.by_id:
                    return target, "inferred"
        return None, None


def _same_key(entities: list[Entity], fields: list[Field], relations: list[Relation]) -> list[Relation]:
    tables: dict[str, list[str]] = defaultdict(list)  # store → table ids
    for entity in entities:
        if entity.kind == "table" and entity.id.startswith("db:"):
            tables[entity.id[3:].split("::", 1)[0]].append(entity.id)
    with_fk = {r.src for r in relations if r.kind == "fk"}
    columns: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for fld in fields:
        if fld.entity.startswith("db:") and fld.name.endswith("_id") and fld.name != "id":
            store = fld.entity[3:].split("::", 1)[0]
            columns[store][fld.name].add(fld.entity)
    out: dict[Relation, None] = {}
    for store, ids in sorted(tables.items()):
        if any(t in with_fk for t in ids):
            continue
        for column, owners in sorted(columns[store].items()):
            ordered = sorted(owners)
            for i, a in enumerate(ordered):
                for b in ordered[i + 1:]:
                    out.setdefault(Relation(a, b, "same_key", Origin(TAG, "inferred", None)), None)
    return list(out)


def resolve(records: list[Any], config: ProjectConfig) -> Resolved:
    entities = [r for r in records if isinstance(r, Entity)]
    fields = [r for r in records if isinstance(r, Field)]
    relations = [r for r in records if isinstance(r, Relation)]
    accesses = [r for r in records if isinstance(r, Access)]
    relations = relations + _same_key(entities, fields, relations)
    resolver = Resolver(entities, config)
    out = Resolved()
    stats = {"relations": 0, "relations_unresolved": 0, "fields_typed": 0, "field_types_unresolved": 0,
             "accesses": 0, "accesses_unresolved": 0, "implicit_entities": 0}

    resolved_imports: dict[Relation, tuple[str | None, str | None]] = {}
    for rel in relations:
        if rel.kind == "imports":
            dst, how = resolver.resolve_module(rel.dst_ref, rel.src)
            resolved_imports[rel] = (dst, how)
            if dst:
                resolver.imports[rel.src].add(dst)

    for rel in relations:
        dst, how = resolved_imports[rel] if rel.kind == "imports" else resolver.resolve(rel.dst_ref, rel.src)
        stats["relations"] += 1
        if dst is None:
            stats["relations_unresolved"] += 1
        row = to_dict(rel)
        row["dst"] = dst
        row["provenance"] = _combine(rel.origin.provenance, how) if dst else rel.origin.provenance
        out.relations.append(row)

    for fld in fields:
        type_id = None
        if fld.type_ref:
            stats["fields_typed"] += 1
            type_id, _ = resolver.resolve(fld.type_ref, fld.entity)
            if type_id is None:
                stats["field_types_unresolved"] += 1
        row = to_dict(fld)
        row["type_id"] = type_id
        out.fields.append(row)

    for acc in accesses:
        target, how = resolver.resolve_target(acc.target_ref, acc.actor)
        stats["accesses"] += 1
        if target is None:
            stats["accesses_unresolved"] += 1
        row = to_dict(acc)
        row["target"] = target
        row["provenance"] = _combine(acc.origin.provenance, how) if target else acc.origin.provenance
        out.accesses.append(row)

    stats["implicit_entities"] = len(resolver.implicit)
    all_entities = list(resolver.table.by_id.values()) + list(resolver.implicit.values())
    out.entities = sorted((to_dict(e) for e in all_entities), key=lambda d: d["id"])
    out.diagnostics = resolver.diagnostics
    out.stats = stats
    return out
