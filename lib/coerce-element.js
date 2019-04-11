import assert, {AssertionError} from '/lib/assert.js';

// Change an element from one element type to another by renaming it. Returns
// the new element that replaced the old element, or the original element if
// no change was made (e.g. because the new name is not different).
//
// Event listeners are not retained, and are not destroyed (this is a caller
// concern).
//
// No change is made (this noops) when the coerced element is an orphan (when
// the coerced element has no parentNode).
//
// Throws an assertion error if shallow validation of the new name fails, which
// indicates that the new name is either null, undefined, an empty string, not a
// string, or has a space. This kind of error indicates a programmer error as
// this function should never be called with such an argument. This explicit
// check is not fully redundant with document.createElement's own checks, as
// this check also prevents document.createElement(null) from creating an
// element with the name "null".
//
// Throws an assertion error if the runtime engine (e.g. v8) considers the tag
// name to be invalid. For example, if the tag name is an unknown element that
// has invalid characters. See:
// https://html.spec.whatwg.org/multipage/
// custom-elements.html#valid-custom-element-name
export default function coerce_element(element, new_name) {
  assert(element instanceof Element);

  // Very explicitly treat certain name inputs as programmer errors, even though
  // some of this is redundant with createElement's validation.
  assert(new_name && typeof new_name === 'string' && !new_name.includes(' '));

  if (element.localName === new_name.toLowerCase()) {
    return element;
  }

  // Create the new element within the same document as the original element.
  // Capture and translate the dom exception that may occur if the name is
  // invalid into an assertion error so as to expose the same type of error in
  // the invalid case.
  let new_element;
  try {
    new_element = element.ownerDocument.createElement(new_name);
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

  const next_sibling = element.nextSibling;

  element.remove();

  const names = element.getAttributeNames();
  for (const name of names) {
    new_element.setAttribute(name, element.getAttribute(name));
  }

  // Move the child nodes provided the new element is not a void element.
  const void_element_localnames = [
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
    'param', 'source', 'track', 'wbr'
  ];
  if (!void_element_localnames.includes(new_element.localName)) {
    // Because we already detached the old element and have not yet attached the
    // new element and both elements belong to the same document, there is no
    // benefit to using a document fragment, so we just move the nodes directly.
    for (let node = element.firstChild; node; node = element.firstChild) {
      new_element.append(node);
    }
  }

  return parent.insertBefore(new_element, next_sibling);
}
