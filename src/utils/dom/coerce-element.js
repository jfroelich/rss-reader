import assert from "/src/assert/assert.js";
import voidElements from "/src/utils/dom/void-elements.js";

// This module exports a single function, coerceElement, that changes the type of an element. An
// element's type is indicated by its name. This is essentially a renaming of the element.
//
// The element's child nodes are retained. However, if the new name is the name of one of HTML's
// void elements, then the child nodes of the element are effectively removed from the document.
//
// Event listeners are lost on rename. See https://stackoverflow.com/questions/15408394.
//
// coerceElement does not validate whether the result is correct. It is the caller's responsibility
// to ensure that the coercion makes sense and that the resulting document is still 'well-formed',
// supposing that well-formedness is a requirement.
//
// @param element {Element} the element to change
// @param newName {String} the name of the element's new type
// @param copyAttributesFlag {Boolean} optional, if true then attributes are maintained, defaults to
// true.
// @throws {AssertionError} if the element is not a type of Element, such as when it is undefined
// @throws {AssertionError} if the new name is not valid, the validity check is very minimal and
// not spec compliant.
// @return {Element} the new element that replaced the old one
export default function coerceElement(element, newName, copyAttributesFlag) {
  assert(element instanceof Element);

  // Document.prototype.createElement is very forgiving regarding a new element's name. For example,
  // if you pass a null value, it will create an element named "null". I find this behavior very
  // confusing and misleading. To avoid this, treat any attempt to use an invalid name as an
  // assertion error. Specifically disallow createElement(null) working like createElement("null")
  assert(isValidElementName(newName));

  if(typeof copyAttributesFlag === 'undefined') {
    copyAttributesFlag = true;
  }

  // Treat attempting to rename an element to the same name as a noop. I've decided to allow this
  // for caller convenience as opposed to throwing an error.
  if(element.localName === newName.toLowerCase()) {
    return element;
  }

  // Prior to detachment, cache the reference to the parent
  const parentElement = element.parentNode;

  // Treat attempting to rename an orphaned element as a noop. Caller not required to guarantee
  // parent for reasons of convenience.
  if(!parentElement) {
    return element;
  }

  // Use next sibling to record position prior to detach. May be undefined.
  const nextSibling = element.nextSibling;

  // Detach the existing node prior to performing other dom operations so that later operations take
  // place on a detached node, so that the least amount of live dom operations are made. Implicitly,
  // this sets element.parentNode and element.nextSibling to undefined.
  element.remove();

  // NOTE: a detached element is still 'owned' by a document
  // NOTE: we are using the document in which the element resides, not the document executing this
  // function. This would otherwise be a serious XSS vulnerability, and also possibly trigger
  // adoption processing (which is slow).

  const newElement = element.ownerDocument.createElement(newName);

  if(copyAttributesFlag) {
    copyAttributes(element, newElement);
  }

  moveChildNodes(element, newElement);

  // Attach the new element in place of the old element. If nextSibling is undefined then
  // insertBefore simply appends. Return the new element.
  return parentElement.insertBefore(newElement, nextSibling);
}

// Move all child nodes of fromElement to toElement, maintaining order. If toElement has existing
// children, the new elements are appended at the end.
// NOTE: I've looked for ways of doing this faster, but nothing seems to work. There is no batch
// move operation in native dom.
// TODO: one possible speedup might be using a document fragment? See what I did for unwrap
function moveChildNodes(fromElement, toElement) {
  // If the target is a void element then this is a no-op. This assumes the source element is
  // detached, otherwise it would be misleading
  if(isVoidElement(toElement)) {
    return;
  }

  let node = fromElement.firstChild;
  while(node) {
    toElement.appendChild(node);
    node = fromElement.firstChild;
  }
}

function isVoidElement(element) {
  // This assumes element.ownerDocument is implicitly flagged as html so that localName yields
  // the normalized name which is in lowercase.
  return voidElements.includes(element.localName);
}

// Returns true if the given name is a valid name for an element. This only does minimal validation
// and may yield false positives. This function is defensive so it can easily be asserted against.
// TODO: research what characters are allowed in an element's name
function isValidElementName(value) {
  return typeof value === 'string' && value.length && !value.includes(' ');
}

// Copies the attributes of an element to another element. Overwrites any existing attributes in the
// other element.
// @param fromElement {Element}
// @param toElement {Element}
// @throws {Error} if either element is not an Element
// @returns void
function copyAttributes(fromElement, toElement) {
  // Use getAttributeNames in preference to element.attributes due to performance issues with
  // element.attributes, and to allow unencumbered use of the for..of syntax (I had issues with
  // NamedNodeMap and for..of).
  const names = fromElement.getAttributeNames();
  for(const name of names) {
    const value = fromElement.getAttribute(name);
    toElement.setAttribute(name, value);
  }
}
