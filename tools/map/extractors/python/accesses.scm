; open(<target>, <mode>) — mode decides read or write in the post-filter.
(call
  function: (identifier) @_open (#eq? @_open "open")
  arguments: (argument_list . (_) @access.target)) @access.read

; Path(...).write_text(...) and friends.
(call
  function: (attribute
    object: (_) @access.target
    attribute: (identifier) @_method (#match? @_method "^(write_text|write_bytes|touch|mkdir|unlink)$"))) @access.write

(call
  function: (attribute
    object: (_) @access.target
    attribute: (identifier) @_method (#match? @_method "^(read_text|read_bytes|open)$"))) @access.read

; SQL handed to a cursor or connection.
(call
  function: (attribute
    attribute: (identifier) @_sql (#match? @_sql "^(execute|executemany|executescript)$"))
  arguments: (argument_list . [(string) (concatenated_string)] @literal.sql))
