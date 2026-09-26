; typescript.structure — capture vocabulary v1 (see map_build/queries.py)

(interface_declaration name: (type_identifier) @entity.name) @entity.interface

(type_alias_declaration name: (type_identifier) @entity.name value: (object_type)) @entity.type

(class_declaration name: (type_identifier) @entity.name) @entity.class

(abstract_class_declaration name: (type_identifier) @entity.name) @entity.class

(enum_declaration name: (identifier) @entity.name) @entity.enum

(export_statement
  declaration: (function_declaration name: (identifier) @entity.name) @entity.function)

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @entity.name
      value: [(arrow_function) (function_expression)]) @entity.function))

; Members.
(interface_declaration
  body: (interface_body
    (property_signature name: (_) @field.name type: (type_annotation (_) @field.type)?)))

(type_alias_declaration
  value: (object_type
    (property_signature name: (_) @field.name type: (type_annotation (_) @field.type)?)))

(class_declaration
  body: (class_body
    (public_field_definition name: (_) @field.name type: (type_annotation (_) @field.type)?)))

(enum_declaration body: (enum_body [(property_identifier) @field.name (enum_assignment name: (property_identifier) @field.name)]))

; Heritage.
(interface_declaration (extends_type_clause type: (_) @relation.inherits))

(class_heritage (extends_clause value: (_) @relation.inherits))

(class_heritage (implements_clause (_) @relation.implements))
