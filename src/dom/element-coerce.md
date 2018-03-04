
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
