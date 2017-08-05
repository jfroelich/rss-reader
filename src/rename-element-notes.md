
# About

rename_element solves the problem that the dom does not provide a native way
of renaming elements. element.tagName and element.localName are read only
properties.

rename_element works by creating a new element, then, moving and copying over
some information from the old element, and then replacing the old element with
the new element.

# Event listeners are not maintained

See https://stackoverflow.com/questions/15408394 for a basic explanation of
why event listeners are lost on rename.

See also https://stackoverflow.com/questions/9046741

# Why parent element is required

Two reasons:

1. A removed element has no parent element. Renaming a removed element is
generally pointless.
2. This needs a way to re-insert an element back into the document, which
involves the parent element.

# An explanation for why the new element name is sanity checked

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

# Why this uses insertBefore at the end of the function

insertBefore's second argument is the reference node. According to MDN,
if the reference node is null, the new node (the 1st argument) is inserted
at the end of the list of the parent's child nodes.

Therefore, there is no need to explicitly test whether the reference node is
defined and use appendChild instead of insertBefore. insertBefore takes care
of the decision for us.

# Why attributes are copied instead of moved

This is copy instead of move because there is no need to remove
attributes from the old even though it will be discarded, that would just be
a waste of resources.

# About move_child_nodes

There does not appear to be a batch move operation available in the dom api.
I spent some time looking and trying to come up with clever alternatives, such
as to_element.innerHTML = from_element.innerHTML.

# TODO

* write tests
* research an authoritative resource on renaming elements and why this
function has to exist as opposed to some native functionality
* research whether I can use for..of on a NamedNodeMap in
copy_element_attributes
