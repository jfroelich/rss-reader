
// element_coerce essentially a renames an element. An element's name indicates
// the element's type. Hence the name of this function, because this effectively
// changes the html type of the element. The element's child nodes are retained,
// generally without regard to whether the new parent-child relations are
// sensible. However, if the new name is the name of one of HTML's void
// elements, then the child nodes of the element are effectively removed (all
// children are removed during the call, but children of void elements are not
// re-added).
//
// Event listeners are lost on rename. See
// https://stackoverflow.com/questions/15408394. This generally is not a concern
// in the case of content filtering because attributes that would cause binding
// are filtered prior to binding.
//
// element_coerce does not validate whether the result is correct, except in the
// case of renaming an element to a known void element. It is the caller's
// responsibility to ensure that the coercion makes sense and that the resulting
// document is still 'well-formed', supposing that well-formedness is a
// requirement. Don't forget, the new element may not belong under its parent,
// or its children may not belong under it either. There is the possiblity of a
// hierarchy error being thrown by the DOM in the final insertBefore call but so
// far I have not encountered it.
//
// @param element {Element} the element to change
// @param new_name {String} the name of the element's new type
// @param copy_attributes_flag {Boolean} optional, if true then attributes are
// maintained, defaults to true.
// @throws {Error} if the input element is not a type of Element, such as when
// it is undefined, or if the new name is not valid. Note that the name validity
// check is very minimal and not spec compliant.
// @return {Element} the new element that replaced the old one

// Document.prototype.createElement is very forgiving regarding a new
// element's name. For example, if you pass a null value, it will create an
// element named "null". I find this behavior very confusing and misleading.
// To avoid this, treat any attempt to use an invalid name as a programming
// error. Specifically disallow createElement(null) working like
// createElement("null")

// Treat attempting to rename an element to the same name as a noop. I've
// decided to allow this for caller convenience as opposed to throwing an
// error. Assume the document is html-flagged

// Treat attempting to rename an orphaned element as a noop. Caller not
// required to guarantee parent for reasons of convenience.

// Detach the existing node prior to performing other dom operations so that
// later operations take place on a detached node, so that the least amount
// of live dom operations are made. Implicitly this sets element.parentNode
// and element.nextSibling to undefined.


// NOTE: a detached element is still 'owned' by a document
// NOTE: we are using the document in which the element resides, not the
// document executing this function. This would otherwise be a serious XSS
// vulnerability, and also possibly trigger document adoption (which is slow).

// Attach the new element in place of the old element. If nextSibling is
// undefined then insertBefore simply appends. Return the new element.

# About element_move_child_nodes

// Move all child nodes of from_element to to_element, maintaining order. If
// to_element has existing children, the new elements are appended at the end.
// NOTE: I've looked for ways of doing this faster, but nothing seems to work.
// There is no batch move operation in native dom.
// TODO: one possible speedup might be using a document fragment? See what I
// did for unwrap
// TODO: might not need to export
// If the target is a void element then this is a no-op. This assumes the
// source element is detached. The result in this case is the child nodes
// are effectively deleted.
// Each call to appendChild does the move. As such, in each iteration, the
// next accessing of old parent's firstChild points to the old parent's new
// first child, if any children are left.

# Element name validation

// Returns true if the given name is a valid name for an element. This only
// does minimal validation and may yield false positives. This function is
// defensive so it can easily be asserted against.
// TODO: research what characters are allowed in an element's name

# Copying attributes

// Copies the attributes of an element to another element. Overwrites any
// existing attributes in the other element.
// @param from_element {Element}
// @param to_element {Element}
// @throws {Error} if either element is not an Element
// @returns void
// Use getAttributeNames in preference to element.attributes due to
// performance issues with element.attributes, and to allow unencumbered use
// of the for..of syntax (I had issues with NamedNodeMap and for..of).

# Void element notes

// See https://html.spec.whatwg.org/multipage/syntax.html#void-elements
// This is a set, but given the small size, it is better to use a simple array.
// Returns whether an element is a void element. This assumes
// element.ownerDocument is implicitly flagged as html so that localName yields
// the normalized name which is in lowercase. For now I'd rather make the
// assumption and let errors happen than incur the cost of calling toLowerCase
