; globalThis[Symbol.for("<key>")] written inside a function.
((subscript_expression
   object: (_) @_global
   index: (call_expression
     function: (member_expression
       object: (identifier) @_symbol (#eq? @_symbol "Symbol")
       property: (property_identifier) @_for (#eq? @_for "for"))
     arguments: (arguments . (string) @access.target))) @access.write
 (#set! access.prefix "global:"))

; const KEY = Symbol.for("<key>"): the key is declared once per module and read through globalThis.
((variable_declarator
   value: (call_expression
     function: (member_expression
       object: (identifier) @_symbol (#eq? @_symbol "Symbol")
       property: (property_identifier) @_for (#eq? @_for "for"))
     arguments: (arguments . (string) @access.target))) @access.write
 (#set! access.prefix "global:"))
