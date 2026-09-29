"""Acceptance for the IR vocabulary, independent of extractor implementation."""
from map_build.ir import ENTITY_KINDS, RELATION_KINDS, Entity, Origin, Relation, Source, validate_record


def test_methods_and_membership_are_valid_records():
    assert "method" in ENTITY_KINDS
    assert "member_of" in RELATION_KINDS
    origin = Origin("typescript.structure@1", "extracted", Source("src/a.ts", 1, 2))
    assert validate_record(Entity("ts:src/a.ts::C.f", "method", "f", origin)) == []
    assert validate_record(Relation("ts:src/a.ts::C.f", "ts:src/a.ts::C", "member_of", origin)) == []
