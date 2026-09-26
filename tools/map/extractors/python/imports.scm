(import_statement name: (dotted_name) @import.source)

(import_statement name: (aliased_import name: (dotted_name) @import.source))

(import_from_statement module_name: (dotted_name) @import.source)

(import_from_statement
  module_name: (relative_import) @import.source
  name: [(dotted_name) @import.name (aliased_import name: (dotted_name) @import.name)])
