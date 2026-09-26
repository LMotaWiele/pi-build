; pi.on("<event>", …) and host.on("<event>", …) subscribe to a pi event.
((call_expression
   function: (member_expression
     object: (identifier) @_host (#any-of? @_host "pi" "host")
     property: (property_identifier) @_on (#eq? @_on "on"))
   arguments: (arguments . (string) @access.target)) @access.subscribe
 (#set! access.prefix "event:pi:"))
