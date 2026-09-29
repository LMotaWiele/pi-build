; python.structure — capture vocabulary v1 (see map_build/queries.py)

(class_definition name: (identifier) @entity.name) @entity.class

(function_definition name: (identifier) @entity.name) @entity.function

(class_definition
  superclasses: (argument_list [(identifier) (attribute)] @relation.inherits))

; Annotated class-body assignments.
(class_definition
  body: (block
    (expression_statement
      (assignment left: (identifier) @field.name type: (type) @field.type))))

; Plain class-body assignments. The post-filter keeps them for enums only.
(class_definition
  superclasses: (argument_list) @_bases
  body: (block
    (expression_statement
      (assignment left: (identifier) @field.name !type))))

; self.<x> = … in __init__ (inferred).
(function_definition
  name: (identifier) @_init (#eq? @_init "__init__")
  body: (block
    (expression_statement
      (assignment
        left: (attribute
          object: (identifier) @_self (#eq? @_self "self")
          attribute: (identifier) @field.name)
        type: (type)? @field.type))))
