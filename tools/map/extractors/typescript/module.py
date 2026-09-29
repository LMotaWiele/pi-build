"""TypeScript post-filter: relative imports to dotted modules, type unwrapping, scope names for arrow functions."""

from __future__ import annotations

import posixpath
import re
from dataclasses import replace
from typing import Any

from map_build.ir import Access, Field, Relation
from map_build.queries import LanguageSpec, text

BUILTIN_TYPES = frozenset({
    "string", "number", "boolean", "null", "undefined", "void", "any", "unknown", "never", "object", "bigint",
    "symbol", "true", "false", "this", "keyof", "typeof", "readonly", "infer", "extends", "in", "is", "as",
    "Array", "ReadonlyArray", "Partial", "Required", "Readonly", "Record", "Pick", "Omit", "Exclude", "Extract",
    "NonNullable", "ReturnType", "Parameters", "InstanceType", "Awaited", "Promise", "Map", "Set", "WeakMap",
    "WeakSet", "Date", "RegExp", "Error", "Function", "Object", "String", "Number", "Boolean", "Symbol",
    "Uint8Array", "Buffer", "NodeJS", "ProcessEnv", "Iterable", "AsyncIterable", "Iterator", "Generator",
})
_NAME = re.compile(r"[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*")
_STRINGS = re.compile(r"(['\"`]).*?\1")
_EXT = re.compile(r"(\.d)?\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$")


def module_name(path: str) -> str:
    return _EXT.sub("", path).replace("/", ".")


def user_types(type_text: str) -> list[str]:
    """`Foo | null`, `Foo[]`, `Array<Foo>`, `Partial<Foo>`, `Record<string, Foo>` → [Foo]."""
    stripped = _STRINGS.sub(" ", type_text)
    stripped = re.sub(r"\{[^{}]*\}", " ", stripped)  # inline object members are not the field's type
    out: list[str] = []
    for name in _NAME.findall(stripped):
        if name in BUILTIN_TYPES or name.split(".")[0] in BUILTIN_TYPES:
            continue
        if name not in out:
            out.append(name)
    return out


def resolve_import(source: str, path: str) -> str:
    """Relative specifiers become dotted repo modules; bare packages stay as written."""
    if not source.startswith("."):
        return source
    joined = posixpath.normpath(posixpath.join(posixpath.dirname(path), source))
    if joined.startswith(".."):
        return source
    return module_name(joined)


def scope_name(node: Any) -> str | None:
    name = node.child_by_field_name("name")
    if name is not None:
        return text(name)
    parent = node.parent
    if parent is not None and parent.type == "variable_declarator":
        declared = parent.child_by_field_name("name")
        return text(declared) if declared is not None else None
    if parent is not None and parent.type == "pair":
        key = parent.child_by_field_name("key")
        return text(key).strip("\"'") if key is not None else None
    return None


def _strip_generic(ref: str) -> str:
    return ref.split("<", 1)[0].strip()


def post_filter(kind: str, record: Any, captures: dict, ctx: Any) -> Any:
    if kind == "field" and isinstance(record, Field):
        out: list[Any] = [record]
        for name in user_types(record.type_ref or ""):
            out.append(Relation(record.entity, name, "has_field_of", record.origin))
        return out
    if kind == "import" and isinstance(record, Relation):
        return replace(record, dst_ref=resolve_import(record.dst_ref, ctx.path))
    if kind == "relation" and isinstance(record, Relation) and record.kind in ("inherits", "implements"):
        return replace(record, dst_ref=_strip_generic(record.dst_ref))
    if kind == "access" and isinstance(record, Access):
        return record
    return record


SPEC = LanguageSpec(
    key="ts",
    scope_types=frozenset({
        "function_declaration", "generator_function_declaration", "method_definition", "class_declaration",
        "abstract_class_declaration", "arrow_function", "function_expression",
    }),
    module_name=module_name,
    scope_name=scope_name,
    filter=post_filter,
)
