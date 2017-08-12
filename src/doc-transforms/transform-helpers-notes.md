
# About

rename_element solves the problem that the dom does not provide a native way
of renaming elements. element.tagName and element.localName are read only
properties.

rename_element works by creating a new element, then, moving and copying over
some information from the old element, and then replacing the old element with
the new element.

unwrap_element solves a similar problem in that the dom does not provide a
simple way of removing a node from the dom, but keeping its children within
the dom in the same location.

# Event listeners are not maintained on rename

* See https://stackoverflow.com/questions/15408394 for a basic explanation of
why event listeners are lost on rename.
* See also https://stackoverflow.com/questions/9046741

# Why parent element is required when renaming/unwrapping

1. A removed element has no parent element. Renaming a removed element is
generally pointless.
2. This needs a way to re-insert an element back into the document, which
requires a parent element.

# Why the new element name is sanity checked when renaming

According to MDN docs, createElement(null) works like createElement("null")
so these guards avoid that.

# Alternate ways to implement element renaming

Detach the existing node, prior to performing other dom operations, so that
the other operations take place on a detached node. Implicitly, this sets
element.parentNode and element.nextSibling to undefined.
There is more than one way to do this function. The reason I've
implemented the function this way is because removing the node first is
O(2) live dom operations, whereas moving the children is O(n+1) live dom
operations. This way requires capturing the next_node reference, but that
probably is faster than touching the dom several times.

For example, see
https://www.quora.com/How-do-I-change-HTML-tag-name-in-JavaScript for what I
think is probably a slower implementation.

# About insertBefore's second argument

insertBefore's second argument is the reference node. According to MDN,
if the reference node is null, the new node (the 1st argument) is inserted
at the end of the list of the parent's child nodes.

Therefore, there is no need to explicitly test whether the reference node is
defined and use appendChild instead of insertBefore. insertBefore takes care
of the decision for us.

# Notes on batch moving of nodes

There does not appear to be a batch node move operation available in the dom
api. I spent some time looking and trying to come up with clever alternatives,
such as to_element.innerHTML = from_element.innerHTML, but nothing was better.

# TODO

* write tests
* research an authoritative resource on renaming elements and why this
function has to exist as opposed to some native functionality
* research whether I can use for..of on a NamedNodeMap when copying attributes
