; fs writes and reads; target is the first argument.
(call_expression
  function: (member_expression
    object: (identifier) @_fs (#match? @_fs "^(fs|fsp|promises)$")
    property: (property_identifier) @_method
      (#match? @_method "^(writeFileSync|appendFileSync|mkdirSync|renameSync|rmSync|writeFile|appendFile|mkdir|rename|rm|unlinkSync|unlink|copyFileSync)$"))
  arguments: (arguments . (_) @access.target)) @access.write

(call_expression
  function: (member_expression
    object: (identifier) @_fs (#match? @_fs "^(fs|fsp|promises)$")
    property: (property_identifier) @_method
      (#match? @_method "^(readFileSync|existsSync|readdirSync|readFile|readdir|statSync)$"))
  arguments: (arguments . (_) @access.target)) @access.read

; SQL handed to node:sqlite.
(call_expression
  function: (member_expression
    property: (property_identifier) @_sql (#match? @_sql "^(prepare|exec)$"))
  arguments: (arguments . [(string) (template_string)] @literal.sql))
