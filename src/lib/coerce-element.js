import assert, { AssertionError } from '/src/lib/assert.js';

// Change an element from one element type to another by renaming it. Returns the new element that
// replaced the old element, or the original element if no change was made (e.g. because the new
// name is not different).
//
// Event listeners are not retained, and are not destroyed.
//
// No change is made when the coerced element is an orphan (when the coerced element has no
// parentNode).
//
// Throws an assertion error if shallow validation of the new name fails, which indicates that the
// new name is either null, undefined, an empty string, not a string, or has a space. This kind of
// error indicates a programmer error as this function should never be called with such an argument.
// This explicit check is not fully redundant with document.createElement's own checks, as this
// check also prevents document.createElement(null) from creating an element with the name "null".
//
// Throws an assertion error if the runtime engine (e.g. v8) considers the tag name to be invalid.
// For example, if the tag name is an unknown element that has invalid characters. See:
// https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
export default function coerceElement(element, newName) {
  assert(element instanceof Element);

  // Very explicitly treat certain name inputs as programmer errors, even though this is redundant
  // with createElement's validation.
  assert(newName && typeof newName === 'string' && !newName.includes(' '));

  if (element.localName === newName.toLowerCase()) {
    return element;
  }

  // Create the new element within the same document as the original element. Capture and translate
  // the dom exception that may occur if the name is invalid into a runtime assertion error.
  let newElement;
  try {
    newElement = element.ownerDocument.createElement(newName);
  } catch (error) {
    if (error instanceof DOMException) {
      throw new AssertionError(error.message);
    } else {
      // unknown error
      throw error;
    }
  }

  const parent = element.parentNode;
  if (!parent) {
    return element;
  }

  const { nextSibling } = element;

  element.remove();

  const names = element.getAttributeNames();
  for (const name of names) {
    newElement.setAttribute(name, element.getAttribute(name));
  }

  // Move the child nodes provided the new element is not a void element.
  const voidElementLocalNames = [
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
    'param', 'source', 'track', 'wbr'
  ];

  if (!voidElementLocalNames.includes(newElement.localName)) {
    // Because we already detached the old element and have not yet attached the new element and
    // both elements belong to the same document, there is no benefit to using a document fragment,
    // so we just move the nodes directly.
    for (let node = element.firstChild; node; node = element.firstChild) {
      newElement.append(node);
    }
  }

  return parent.insertBefore(newElement, nextSibling);
}
