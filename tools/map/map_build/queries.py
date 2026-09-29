"""The generic tree-sitter query runner.

Capture vocabulary (version 1). Names starting with `_` are private to a pattern and
are only passed to the language post-filter.

  @entity.<kind> on the whole node, with @entity.name   → Entity (nested functions and methods get member_of)
  @field.name, optional @field.type                     → Field (owner: entity in the match, else innermost enclosing entity)
  @relation.inherits / @relation.implements             → Relation (src: same owner rule)
  @import.source, optional @import.name                 → Relation(kind="imports") from the module
  @access.<mode> with @access.target                    → Access (actor: innermost enclosing scope, else module)
  @literal.sql                                          → Access per table via map_build.sql

Pattern setting (tree-sitter `#set!` directive):

  (#set! access.prefix "event:pi:")                     → prefix every access target from that pattern
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, replace
from typing import Any, Callable, Iterable

import tree_sitter

from .context import FileContext
from .ir import Access, Entity, Field, Origin, Relation, Source
from .sql import sql_accesses

CAPTURE_VOCABULARY_VERSION = 1
ACCESS_MODES = ("read", "write", "subscribe", "emit")

Filter = Callable[[str, Any, dict, FileContext], Any]


def _default_scope_name(node: tree_sitter.Node) -> str | None:
    name = node.child_by_field_name("name")
    return name.text.decode("utf-8", "replace") if name is not None else None


@dataclass(frozen=True)
class LanguageSpec:
    """What the runner needs from a language package. Pure data plus small node helpers."""

    key: str
    scope_types: frozenset[str]
    module_name: Callable[[str], str]
    scope_name: Callable[[tree_sitter.Node], str | None] = _default_scope_name
    filter: Filter | None = None
    extra: dict = field(default_factory=dict)


_QUERY_CACHE: dict[tuple[int, str], tree_sitter.Query] = {}


def compile_query(language: tree_sitter.Language, source: str) -> tree_sitter.Query:
    key = (hash(language), source)  # hashes the grammar pointer; names can be None
    query = _QUERY_CACHE.get(key)
    if query is None:
        query = tree_sitter.Query(language, source)
        _QUERY_CACHE[key] = query
    return query


def text(node: tree_sitter.Node) -> str:
    return node.text.decode("utf-8", "replace")


_PREFIX = re.compile(r"^[rRbBuUfF]{0,2}")


def unquote(raw: str) -> str:
    """Strip string delimiters: Python prefixes and triple quotes, JS quotes and backticks."""
    body = _PREFIX.sub("", raw, count=1) if raw[:1] not in "\"'`" else raw
    for quote in ('"""', "'''"):
        if body.startswith(quote) and body.endswith(quote) and len(body) >= 6:
            return body[3:-3]
    if len(body) >= 2 and body[0] in "\"'`" and body[-1] == body[0]:
        return body[1:-1]
    return raw


def is_string_node(node: tree_sitter.Node) -> bool:
    return node.type in ("string", "template_string", "string_literal", "string_fragment")


def _key(node: tree_sitter.Node) -> tuple[int, int, str]:
    return (node.start_byte, node.end_byte, node.type)


class Runner:
    def __init__(self, ctx: FileContext, lang: LanguageSpec, tag: str):
        self.ctx = ctx
        self.lang = lang
        self.tag = tag
        self.module_id = f"{lang.key}:{ctx.path}"
        self.entities: dict[tuple[int, int, str], tuple[str, str]] = {}  # node key → (name, kind)

    def origin(self, node: tree_sitter.Node | None, provenance: str = "extracted") -> Origin:
        source = None
        if node is not None:
            source = Source(self.ctx.path, node.start_point[0] + 1, node.end_point[0] + 1)
        return Origin(self.tag, provenance, source)  # type: ignore[arg-type]

    def scope_label(self, node: tree_sitter.Node) -> str | None:
        hit = self.entities.get(_key(node))
        if hit:
            return hit[0]
        if node.type in self.lang.scope_types:
            return self.lang.scope_name(node)
        return None

    def qualname(self, node: tree_sitter.Node, include_self: bool = True) -> list[str]:
        names: list[str] = []
        current = node if include_self else node.parent
        last: tree_sitter.Node | None = None
        while current is not None:
            label = self.scope_label(current)
            # `const f = () => {}`: the declarator and its function name the same scope.
            if label and not (names and last is not None and last.parent == current and names[-1] == label):
                names.append(label)
                last = current
            elif label:
                last = current
            current = current.parent
        return list(reversed(names))

    def symbol_id(self, parts: list[str]) -> str:
        return f"{self.module_id}::{'.'.join(parts)}" if parts else self.module_id

    def owner(self, node: tree_sitter.Node) -> str | None:
        current = node.parent
        while current is not None:
            if _key(current) in self.entities:
                return self.symbol_id(self.qualname(current))
            current = current.parent
        return None

    def actor(self, node: tree_sitter.Node) -> str:
        return self.symbol_id(self.qualname(node, include_self=False))


def run_queries(ctx: FileContext, sources: Iterable[str], lang: LanguageSpec, tag: str, emit_module: bool = True) -> list[Any]:
    """Run `.scm` sources over one parsed file and return IR records in a stable order."""
    if ctx.tree is None:
        return []
    language = ctx.tree.language
    matches: list[dict[str, list[tree_sitter.Node]]] = []
    settings: list[dict] = []
    for source in sources:
        query = compile_query(language, source)
        for pattern, captures in tree_sitter.QueryCursor(query).matches(ctx.tree.root_node):
            matches.append(captures)
            settings.append(query.pattern_settings(pattern) or {})

    runner = Runner(ctx, lang, tag)
    entity_matches: list[tuple[tree_sitter.Node, str, dict]] = []
    for captures in matches:
        kinds = [k for k in captures if k.startswith("entity.") and k != "entity.name"]
        if not kinds or "entity.name" not in captures:
            continue
        node = captures[kinds[0]][0]
        name = text(captures["entity.name"][0])
        runner.entities[_key(node)] = (name, kinds[0][len("entity."):])
        entity_matches.append((node, kinds[0][len("entity."):], captures))

    out: dict[Any, None] = {}

    def emit(kind: str, record: Any, captures: dict) -> None:
        result = lang.filter(kind, record, captures, ctx) if lang.filter else record
        if result is None:
            return
        for item in result if isinstance(result, list) else [result]:
            out.setdefault(item, None)

    if emit_module:
        out.setdefault(Entity(runner.module_id, "module", lang.module_name(ctx.path), runner.origin(ctx.tree.root_node)), None)

    for node, kind, captures in entity_matches:
        # A Python def is a method only when its nearest enclosing named scope
        # is a class (decorators and blocks are transparent to this lookup).
        if lang.key == "py" and kind == "function":
            ancestor = node.parent
            while ancestor is not None and ancestor.type not in lang.scope_types:
                ancestor = ancestor.parent
            if ancestor is not None and ancestor.type == "class_definition":
                kind = "method"
        entity_id = runner.symbol_id(runner.qualname(node))
        emit("entity", Entity(entity_id, kind, runner.entities[_key(node)][0], runner.origin(node)), captures)
        parent = runner.owner(node)
        emit("relation", Relation(parent or runner.module_id, entity_id, "defines", runner.origin(node)), captures)
        if parent and kind in ("function", "method"):
            emit("relation", Relation(entity_id, parent, "member_of", runner.origin(node)), captures)

    for captures, setting in zip(matches, settings):
        prefix = str(setting.get("access.prefix") or "")
        match_owner = None
        kinds = [k for k in captures if k.startswith("entity.") and k != "entity.name"]
        if kinds:
            match_owner = runner.symbol_id(runner.qualname(captures[kinds[0]][0]))
        for name_node in captures.get("field.name", []):
            owner = match_owner or runner.owner(name_node)
            # self.x in __init__ describes the class, not the newly captured method.
            if lang.key == "py" and "_init" in captures:
                scope = name_node.parent
                while scope is not None and scope.type != "function_definition":
                    scope = scope.parent
                if scope is not None:
                    owner = runner.owner(scope)
            if owner is None:
                continue
            type_nodes = captures.get("field.type", [])
            type_ref = text(type_nodes[0]) if type_nodes else None
            emit("field", Field(owner, text(name_node), type_ref, runner.origin(name_node)), captures)
        for rel_kind in ("inherits", "implements"):
            for dst in captures.get(f"relation.{rel_kind}", []):
                owner = match_owner or runner.owner(dst)
                if owner is None:
                    continue
                emit("relation", Relation(owner, text(dst), rel_kind, runner.origin(dst)), captures)
        for src_node in captures.get("import.source", []):
            ref = unquote(text(src_node)) if is_string_node(src_node) else text(src_node)
            emit("import", Relation(runner.module_id, ref, "imports", runner.origin(src_node)), captures)
        for mode in ACCESS_MODES:
            for node in captures.get(f"access.{mode}", []):
                targets = captures.get("access.target", [])
                if not targets:
                    continue
                target = targets[0]
                ref = unquote(text(target)) if is_string_node(target) else text(target)
                emit("access", Access(runner.actor(node), prefix + ref, mode, runner.origin(node)), captures)  # type: ignore[arg-type]
        for node in captures.get("literal.sql", []):
            actor = runner.actor(node)
            for table, mode in sql_accesses(unquote(text(node))):
                emit("access", Access(actor, f"db:?::{table}", mode, runner.origin(node)), captures)  # type: ignore[arg-type]
    return list(out)


def with_provenance(record: Any, provenance: str) -> Any:
    return replace(record, origin=replace(record.origin, provenance=provenance))
