"""IR records, JSON Lines serialization, and the JSON Schema they validate against."""

from __future__ import annotations

import dataclasses
import json
import re
from dataclasses import dataclass, field
from typing import Any, Literal, get_args

SCHEMA_VERSION = 1

Provenance = Literal["extracted", "inferred"]
AccessMode = Literal["read", "write", "subscribe", "emit"]
EventKind = Literal["turn", "loop", "model", "tool", "guard", "subagent", "hook", "function"]
Severity = Literal["warning", "error"]

ENTITY_KINDS = (
    "module", "class", "interface", "type", "dataclass", "pydantic", "typeddict", "enum",
    "function", "method", "table", "file_store", "config", "event", "global",
)
RELATION_KINDS = ("has_field_of", "inherits", "implements", "fk", "imports", "defines", "same_key", "member_of")


@dataclass(frozen=True)
class Source:
    path: str
    line: int
    end_line: int


@dataclass(frozen=True)
class Origin:
    extractor: str
    provenance: Provenance
    source: Source | None


@dataclass(frozen=True)
class FileMetric:
    path: str
    lang: str
    nloc: int
    functions: int
    ccn_max: int
    ccn_sum: int
    origin: Origin


@dataclass(frozen=True)
class FunctionMetric:
    id: str
    path: str
    name: str
    start_line: int
    end_line: int
    nloc: int
    ccn: int
    params: int
    origin: Origin


@dataclass(frozen=True)
class Entity:
    id: str
    kind: str
    name: str
    origin: Origin


@dataclass(frozen=True)
class Field:
    entity: str
    name: str
    type_ref: str | None
    origin: Origin


@dataclass(frozen=True)
class Relation:
    src: str
    dst_ref: str
    kind: str
    origin: Origin


@dataclass(frozen=True)
class Access:
    actor: str
    target_ref: str
    mode: AccessMode
    origin: Origin


@dataclass(frozen=True)
class CallEvent:
    trace: str
    span: str
    parent: str | None
    name: str
    kind: EventKind
    start_ms: float
    dur_ms: float | None
    attrs: dict = field(hash=False, compare=True)
    origin: Origin | None = None


@dataclass(frozen=True)
class Diagnostic:
    extractor: str
    path: str | None
    severity: Severity
    message: str


RECORD_TYPES: dict[str, type] = {
    cls.__name__: cls
    for cls in (FileMetric, FunctionMetric, Entity, Field, Relation, Access, CallEvent, Diagnostic)
}

# ---------------------------------------------------------------- identifiers

_LANG = r"[a-z][a-z0-9_]*"
_PATH = r"[^\s:][^\s]*?"
ID_PATTERNS = {
    "module": re.compile(rf"^(?!db:|file:|event:|global:){_LANG}:{_PATH}$"),
    "symbol": re.compile(rf"^(?!db:|file:|event:|global:){_LANG}:{_PATH}::\S+$"),
    "table": re.compile(r"^db:[^\s:]+::[^\s.]+$"),
    "column": re.compile(r"^db:[^\s:]+::[^\s.]+\.\S+$"),
    "store": re.compile(r"^db:[^\s:]+$"),
    "file_store": re.compile(r"^file:\S+$"),
    "event": re.compile(r"^event:[^\s:]+:\S+$"),
    "global": re.compile(r"^global:\S+$"),
}


def id_form(identifier: str) -> str | None:
    """Which §4.1 form an identifier takes, or None when it matches none."""
    for name in ("symbol", "column", "table", "store", "file_store", "event", "global", "module"):
        if ID_PATTERNS[name].match(identifier):
            return name
    return None


def module_of(identifier: str) -> str:
    """The module id that owns a code identifier (`ts:a.ts::X.y` → `ts:a.ts`)."""
    return identifier.split("::", 1)[0]


def path_of(identifier: str) -> str | None:
    """The repo-relative file of a code identifier, or None for db/file/event/global ids."""
    if id_form(identifier) not in ("module", "symbol"):
        return None
    return module_of(identifier).split(":", 1)[1]


# -------------------------------------------------------------- serialization

def to_dict(record: Any) -> dict:
    data = dataclasses.asdict(record)
    data["type"] = type(record).__name__
    return data


def _source(data: dict | None) -> Source | None:
    return Source(**data) if data else None


def _origin(data: dict | None) -> Origin | None:
    if data is None:
        return None
    return Origin(extractor=data["extractor"], provenance=data["provenance"], source=_source(data.get("source")))


def from_dict(data: dict) -> Any:
    data = dict(data)
    cls = RECORD_TYPES[data.pop("type")]
    if "origin" in data:
        data["origin"] = _origin(data["origin"])
    return cls(**data)


def dumps(record: Any) -> str:
    return json.dumps(to_dict(record), sort_keys=True, separators=(",", ":"))


def sort_key(record: Any) -> str:
    return dumps(record)


# --------------------------------------------------------------------- schema

def _nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


def _obj(props: dict, required: list[str] | None = None, extra: bool = False) -> dict:
    return {
        "type": "object",
        "properties": props,
        "required": list(props) if required is None else required,
        "additionalProperties": extra,
    }


def json_schema() -> dict:
    string = {"type": "string"}
    integer = {"type": "integer"}
    number = {"type": "number"}
    source = _obj({"path": string, "line": integer, "end_line": integer})
    origin = _obj({
        "extractor": {"type": "string", "pattern": r"^[^@\s]+@\d+$"},
        "provenance": {"enum": list(get_args(Provenance))},
        "source": _nullable(source),
    })

    def record(name: str, props: dict) -> dict:
        props = {"type": {"const": name}, **props}
        return _obj(props)

    defs = {
        "FileMetric": record("FileMetric", {
            "path": string, "lang": string, "nloc": integer, "functions": integer,
            "ccn_max": integer, "ccn_sum": integer, "origin": origin,
        }),
        "FunctionMetric": record("FunctionMetric", {
            "id": string, "path": string, "name": string, "start_line": integer, "end_line": integer,
            "nloc": integer, "ccn": integer, "params": integer, "origin": origin,
        }),
        "Entity": record("Entity", {"id": string, "kind": {"enum": list(ENTITY_KINDS)}, "name": string, "origin": origin}),
        "Field": record("Field", {"entity": string, "name": string, "type_ref": _nullable(string), "origin": origin}),
        "Relation": record("Relation", {"src": string, "dst_ref": string, "kind": {"enum": list(RELATION_KINDS)}, "origin": origin}),
        "Access": record("Access", {"actor": string, "target_ref": string, "mode": {"enum": list(get_args(AccessMode))}, "origin": origin}),
        "CallEvent": record("CallEvent", {
            "trace": string, "span": string, "parent": _nullable(string), "name": string,
            "kind": {"enum": list(get_args(EventKind))}, "start_ms": number, "dur_ms": _nullable(number),
            "attrs": {"type": "object"}, "origin": _nullable(origin),
        }),
        "Diagnostic": record("Diagnostic", {
            "extractor": string, "path": _nullable(string), "severity": {"enum": list(get_args(Severity))}, "message": string,
        }),
    }
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "map_build IR",
        "schema_version": SCHEMA_VERSION,
        "$defs": defs,
        "oneOf": [{"$ref": f"#/$defs/{name}"} for name in defs],
    }


def validate(instance: Any, schema: dict, root: dict | None = None, where: str = "$") -> list[str]:
    """A validator for the subset of JSON Schema that json_schema() uses."""
    root = root or schema
    errors: list[str] = []
    if "$ref" in schema:
        name = schema["$ref"].rsplit("/", 1)[1]
        return validate(instance, root["$defs"][name], root, where)
    if "oneOf" in schema:
        # Records are tagged, so dispatch on the tag; the `const` on `type` keeps the branches disjoint.
        kind = instance.get("type") if isinstance(instance, dict) else None
        if isinstance(kind, str) and kind in root.get("$defs", {}):
            return validate(instance, root["$defs"][kind], root, where)
        errors.append(f"{where}: no record schema for type {kind!r}")
        return errors
    if "anyOf" in schema:
        if not any(not validate(instance, s, root, where) for s in schema["anyOf"]):
            errors.append(f"{where}: matches no alternative")
        return errors
    if "const" in schema and instance != schema["const"]:
        errors.append(f"{where}: expected {schema['const']!r}")
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{where}: {instance!r} not in {schema['enum']}")
    kind = schema.get("type")
    checks = {
        "string": lambda v: isinstance(v, str),
        "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
        "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
        "object": lambda v: isinstance(v, dict),
        "null": lambda v: v is None,
    }
    if kind and not checks[kind](instance):
        errors.append(f"{where}: expected {kind}")
        return errors
    if "pattern" in schema and isinstance(instance, str) and not re.search(schema["pattern"], instance):
        errors.append(f"{where}: {instance!r} does not match {schema['pattern']}")
    if kind == "object":
        props = schema.get("properties", {})
        for key in schema.get("required", []):
            if key not in instance:
                errors.append(f"{where}: missing {key}")
        for key, value in instance.items():
            if key in props:
                errors.extend(validate(value, props[key], root, f"{where}.{key}"))
            elif schema.get("additionalProperties") is False:
                errors.append(f"{where}: unexpected {key}")
    return errors


def validate_record(record: Any) -> list[str]:
    return validate(to_dict(record), json_schema())
