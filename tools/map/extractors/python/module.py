"""Python post-filter: entity kinds from decorators and bases, open() modes, type unwrapping, relative imports."""

from __future__ import annotations

import posixpath
import re
from dataclasses import replace
from typing import Any

from map_build.ir import Access, Entity, Field, Relation
from map_build.queries import LanguageSpec, is_string_node, text, unquote, with_provenance

BUILTIN_TYPES = frozenset({
    "int", "str", "float", "bool", "bytes", "bytearray", "complex", "None", "NoneType", "object", "type",
    "list", "dict", "set", "frozenset", "tuple", "List", "Dict", "Set", "FrozenSet", "Tuple",
    "Optional", "Union", "Any", "Literal", "Callable", "Iterable", "Iterator", "Sequence", "Mapping",
    "MutableMapping", "MutableSequence", "Generator", "AsyncIterator", "Awaitable", "Coroutine",
    "ClassVar", "Final", "Annotated", "Self", "TypeVar", "Generic", "Protocol", "NotRequired", "Required",
    "typing", "collections", "abc", "datetime", "date", "time", "timedelta", "Path", "Decimal", "UUID",
    "Enum", "IntEnum", "StrEnum",
})
_NAME = re.compile(r"[A-Za-z_][\w.]*")
_STRING = re.compile(r"(['\"])(.*?)\1")
_ENUM_BASES = re.compile(r"\b(Enum|IntEnum|StrEnum|Flag|IntFlag)\b")


def module_name(path: str) -> str:
    stem = re.sub(r"\.pyi?$", "", path)
    if stem.endswith("/__init__") or stem == "__init__":
        stem = stem[: -len("__init__")].rstrip("/")
    return stem.replace("/", ".")


def user_types(type_text: str) -> list[str]:
    """Innermost user type names: `Optional[list[Foo]]` → [Foo], `dict[str, Bar] | None` → [Bar]."""
    unquoted = _STRING.sub(lambda m: m.group(2), type_text)
    out: list[str] = []
    for name in _NAME.findall(unquoted):
        head = name.split(".")[0]
        if name in BUILTIN_TYPES or head in ("typing", "collections", "t") or name.split(".")[-1] in BUILTIN_TYPES:
            continue
        if name not in out:
            out.append(name)
    return out


def _entity_kind(node_text_bases: str, decorators: str) -> str:
    if re.search(r"\bdataclass\b", decorators):
        return "dataclass"
    if re.search(r"\bBaseModel\b", node_text_bases):
        return "pydantic"
    if re.search(r"\bTypedDict\b", node_text_bases):
        return "typeddict"
    if _ENUM_BASES.search(node_text_bases):
        return "enum"
    return "class"


def _class_kind(node: Any) -> str:
    bases = node.child_by_field_name("superclasses")
    decorators = ""
    if node.parent is not None and node.parent.type == "decorated_definition":
        decorators = " ".join(text(c) for c in node.parent.children if c.type == "decorator")
    return _entity_kind(text(bases) if bases is not None else "", decorators)


def _open_mode(call: Any) -> str | None:
    args = call.child_by_field_name("arguments")
    if args is None:
        return None
    positional = [c for c in args.named_children if c.type not in ("keyword_argument", "comment")]
    for kw in (c for c in args.named_children if c.type == "keyword_argument"):
        name = kw.child_by_field_name("name")
        value = kw.child_by_field_name("value")
        if name is not None and text(name) == "mode" and value is not None and is_string_node(value):
            return unquote(text(value))
    if len(positional) >= 2 and is_string_node(positional[1]):
        return unquote(text(positional[1]))
    return None


def _target(node: Any) -> str:
    """Unwrap `Path(x)`, `Path(x) / "y"`, and string literals to the most specific name."""
    while True:
        if node.type == "call":
            fn = node.child_by_field_name("function")
            args = node.child_by_field_name("arguments")
            if fn is not None and text(fn).split(".")[-1] in ("Path", "PurePath") and args is not None and args.named_children:
                node = args.named_children[0]
                continue
        if node.type == "binary_operator":
            # `root / "x.json"` names the right side; `"dir/" + name` the literal left side.
            op = node.child_by_field_name("operator")
            side = node.child_by_field_name("left" if op is not None and text(op) == "+" else "right")
            if side is not None:
                node = side
                continue
        if node.type == "parenthesized_expression" and node.named_children:
            node = node.named_children[0]
            continue
        break
    return unquote(text(node)) if is_string_node(node) else text(node)


def _resolve_relative(source: str, name: str | None, path: str) -> str:
    dots = len(source) - len(source.lstrip("."))
    rest = source[dots:]
    package = posixpath.dirname(path).split("/") if posixpath.dirname(path) else []
    if dots > 1:
        package = package[: max(0, len(package) - (dots - 1))]
    parts = package + ([rest] if rest else ([name] if name else []))
    return ".".join(p for p in parts if p)


def post_filter(kind: str, record: Any, captures: dict, ctx: Any) -> Any:
    if kind == "entity" and isinstance(record, Entity) and record.kind == "class":
        node_list = captures.get("entity.class")
        if node_list:
            return replace(record, kind=_class_kind(node_list[0]))
        return record
    if kind == "field" and isinstance(record, Field):
        if "_bases" in captures and not _ENUM_BASES.search(text(captures["_bases"][0])):
            return None
        out: list[Any] = [with_provenance(record, "inferred") if "_init" in captures else record]
        for name in user_types(record.type_ref or ""):
            out.append(Relation(record.entity, name, "has_field_of", out[0].origin))
        return out
    if kind == "import" and isinstance(record, Relation):
        source = record.dst_ref
        if source.startswith("."):
            names = captures.get("import.name")
            name = text(names[0]) if names else None
            only_dots = not source.lstrip(".")
            return replace(record, dst_ref=_resolve_relative(source, name if only_dots else None, ctx.path))
        return record
    if kind == "access" and isinstance(record, Access):
        if "_open" in captures:
            mode = _open_mode(captures["access.read"][0])
            new_mode = "write" if mode and any(c in mode for c in "wax+") else "read"
            return with_provenance(replace(record, mode=new_mode, target_ref=_target(captures["access.target"][0])), "inferred")
        if "_method" in captures:
            mode = record.mode
            if text(captures["_method"][0]) == "open":
                call = captures["access.read"][0]
                args = call.child_by_field_name("arguments")
                first = args.named_children[0] if args is not None and args.named_children else None
                if first is not None and is_string_node(first) and any(c in unquote(text(first)) for c in "wax+"):
                    mode = "write"
            return with_provenance(replace(record, mode=mode, target_ref=_target(captures["access.target"][0])), "inferred")
        return record
    return record


SPEC = LanguageSpec(
    key="py",
    scope_types=frozenset({"function_definition", "class_definition"}),
    module_name=module_name,
    filter=post_filter,
)
