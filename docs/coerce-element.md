# coerce-element
Renames an element. Retains child nodes unless the node is void. Event listeners are not retained.

This tolerates some bad input. For example, if the new name is the same as the old, this detects that case and exits early and does not DOM modification.

## New name validation
This performs some minimal validation of the new name for the element so as to avoid some undesirable outputs. For example, this checks if the new name is null. Internally this calls `document.createElement`, which accepts a name parameter, and behaves unexpectedly by creating an element named <null> when passing an invalid argument like `document.createElement(null);`.

## Void elements
See https://html.spec.whatwg.org/multipage/syntax.html#void-elements.

## TODOs
* consider implementing `move_child_nodes` using a document fragment
* increase accuracy of `is_valid_element_name`, research what actual characters are allowed
