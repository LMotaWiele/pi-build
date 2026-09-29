# Codebase map

`map_build` extracts code and data records from a repository and renders a self-contained map. Run `uv run --project tools/map python -m map_build --repo . --out .agent/map` from the repository root; run its checks with `uv run --project tools/map pytest -q tools/map`.

Structure extractors emit qualified `Entity` ids for named declarations. `function` includes nested named functions and named arrow/function-expression variables; `method` is a class member (including getters and setters). Anonymous callbacks remain attributed to their innermost named scope, not separate entities. `defines` points from an enclosing scope to its declaration; `member_of` points from a nested function or method **to** its enclosing function or class. Both relations are retained for owned declarations.

In `erd.json`, each entity has `layer` (`data` or `code`) and `test` (boolean). Tables, file stores, config, dataclasses, Pydantic models, TypedDicts, enums and globals are data. Classes, interfaces and type aliases with fields are also data, while fieldless declarations and executable functions and methods are code. An owner with data fields can still own code methods. Files under `tests/` and conventional Python/TypeScript test filenames are marked as test code.

The TypeScript and Python conformance fixtures and sorted JSONL goldens live under `extractors/{typescript,python}/fixtures/`. To compare extractor changes, run `uv run --project tools/map pytest -q tools/map/conformance`; changes must retain all previously emitted records.
