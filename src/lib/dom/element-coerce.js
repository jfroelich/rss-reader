
/*

# element-coerce
`element_coerce` renames an element. An element's name indicates the element's
type. Hence the name of this function, because this effectively changes the type
of the element. The element's child nodes are retained, generally without regard
to whether the new parent-child relations are sensible. However, if the new name
is a known void element, then the child nodes of the element are removed (the
child nodes from the old node are not moved to the new node).

Event listeners are not retained. See
https://stackoverflow.com/questions/15408394. This generally is not a concern in
the case of content filtering because attributes that would cause binding are
filtered prior to binding. However, this should be kept in mind if operating on
a live document.

This does not validate whether the result is correct, except in the case of
renaming an element to a known void element. It is the caller's responsibility
to ensure that the coercion makes sense and that the resulting document is still
*well-formed*, supposing that is a requirement. Do not forget, the new element
may not belong under its parent, or its children may not belong under it. There
is also the possibility of a hierarchy error being thrown by the DOM but so far
I have not encountered it.

### Params
* **element** {Element} the element to change
* new_name {String} the name of the element's new type
* copy_attributes_flag {Boolean} optional, if true then attributes are
maintained, defaults to true.

### Errors
* {Error} if the input element is not a type of Element, such as when it is
undefined, or if the new name is not valid. Note that the name validity check is
very minimal and not spec compliant.

### Return value
Returns the new element that replaced the old one

### Implementation notes
Document.prototype.createElement is very forgiving regarding a new element's
name. For example, if you pass a null value, it will create an element named
"null". This is misleading. To avoid this, treat any attempt to use an invalid
name as a programming error. Specifically disallow `createElement(null)` working
like `createElement("null")`.

Treat attempting to rename an element to the same name as a noop. I've decided
to allow this for caller convenience as opposed to throwing an error. Assume the
document is html-flagged.

Treat attempting to rename an orphaned element as a noop. The caller is not
required to guarantee parent for reasons of convenience.

Detach the existing node prior to performing other dom operations so that later
operations take place on a detached node, so that the least amount of live dom
operations are made. Implicitly this sets element.parentNode and
element.nextSibling to undefined.

* A detached element is still 'owned' by a document
* This uses the document in which the element resides, not the
document executing this function. This would otherwise be an XSS
issue, and possibly trigger adoption (which is slow).
* This uses `insertBefore` to reattach. If the `nextSibling` parameter to
`insertBefore` is `undefined` then `insertBefore` simply appends (it basically
turns into appendChild). Notably there is no need to explicitly check if
`nextSibling` is defined. It just feels confusing to call a function with a
missing value and have it work as expected.

# About moving child nodes
The helper moves all child nodes of `from_element` to `to_element`, maintaining
order. If `to_element` has existing children, the new elements are appended at
the end.

* I've looked for ways of doing this faster, but nothing seems to work. There is
no batch move operation in native dom.
* One possible speedup might be using a document fragment? See what I did for
unwrap
* Maybe the helper should not be exported
* If the target is a void element then this is a no-op.
* This assumes the source element is detached. The result in this case is the
child nodes are effectively deleted.
* The `appendChild` loop looks confusing at first. That is because `appendChild`
is a *move* operation, which involves both node creation and node deletion. In
each iteration of the loop, the next accessing of the old parent's `firstChild`
points to the old parent's new first child, if any children are left, because
its internal reference is implicitly updated by the delete part of the
`appendChild` call, because all child nodes are shifted.

# Element name validation
Returns true if the given name is a valid name for an element. This only does
minimal validation and may yield false positives. This function is defensive so
it can easily be asserted against.

# Copying attributes
Copies the attributes of an element to another element. Overwrites any existing
attributes in the other element. Throws an error if either element is not an
Element. Notably this uses `getAttributeNames` in preference to
`element.attributes` due to performance issues with `element.attributes`, and to
allow unencumbered use of the `for..of` syntax (I had issues with `NamedNodeMap`
and `for..of`).

# Void element notes
See https://html.spec.whatwg.org/multipage/syntax.html#void-elements. This is a
set, but given the small size, it is better to use a simple array. Returns
whether an element is a void element. This assumes `element.ownerDocument` is
implicitly flagged as html so that `localName` yields the normalized name which
is in lowercase. For now I'd rather make the assumption and let errors happen
than incur the cost of calling `toLowerCase`.

### TODOs
* todo: research what characters are allowed in an element's name
* consider renaming to `coerce-element`


*/

// TODO: move the docs back into here as comments, it is much easier to maintain
// and more standalone
// TODO: add console parameter
// TODO: rename to coerce-element (both file and function)
// TODO: maybe move to subfolder element within lib
// TODO: maybe merge into its one callsite

export function element_coerce(element, new_name, copy_attributes = true) {
  if (!(element instanceof Element)) {
    throw new TypeError('element is not an Element');
  }

  if (!is_valid_element_name(new_name)) {
    throw new TypeError('Invalid new name ' + new_name);
  }

  if (element.localName === new_name.toLowerCase()) {
    return element;
  }

  const parent_element = element.parentNode;
  if (!parent_element) {
    return element;
  }

  const next_sibling = element.nextSibling;

  element.remove();

  const new_element = element.ownerDocument.createElement(new_name);

  if (copy_attributes) {
    copy_element_attributes(element, new_element);
  }

  move_child_nodes(element, new_element);

  return parent_element.insertBefore(new_element, next_sibling);
}

export function move_child_nodes(from_element, to_element) {
  if (is_void_element(to_element)) {
    return;
  }

  let node = from_element.firstChild;
  while (node) {
    to_element.appendChild(node);
    node = from_element.firstChild;
  }
}

const void_elements = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
];

export function is_void_element(element) {
  return void_elements.includes(element.localName);
}

function is_valid_element_name(value) {
  return typeof value === 'string' && value.length && !value.includes(' ');
}

export function copy_element_attributes(from_element, to_element) {
  const names = from_element.getAttributeNames();
  for (const name of names) {
    const value = from_element.getAttribute(name);
    to_element.setAttribute(name, value);
  }
}
