import {assert} from '/src/lib/assert.js';

// Change an element from one element type to another by renaming it. As the DOM
// does not allow renaming, we create a new element in place of the old. Returns
// the new element that replaced the old element. Note that in a few cases, such
// as when renaming an element to the same name, the new element that is
// returned may be the same node as the old element. Otherwise the old element
// is detached from the dom and left for GC.
//
// Throws an error when input is invalid (e.g. called on something that is not
// an element, using a bad element name).
//
// Note that due to DOM restrictions, various real time features like event
// listeners are lost during the transition.
export function coerce_element(element, new_name) {
  // Loosely require element be an element. instanceof is avoided to allow for
  // duck typing. We could instead allow this error to occur naturally later on
  // but using an upfront assertion simplifies debugging.
  assert(element && element.localName);

  // Loosely require the new name to look like a valid element name. It is
  // an invariant programmer error to call coerce-element with an invalid name.
  // We want to also explicitly rule out some surprising behavior from the later
  // call to createElement, such as createElement(null) creating an element with
  // the name "null" instead of failing with an expected error.
  // TODO: consider making this check more accurate, such as by checking for
  // other unwanted characters, perhaps using a regex.
  assert(new_name && typeof new_name === 'string' && !new_name.includes(' '));

  // If the new name is the same as the old, then noop. This is not an error
  // for similar reasons that coercing an orphaned element is not an error.
  // Note that we assume localName yields a lowercase string (this is not always
  // true for XML-flagged documents, but coerce is only intended for
  // HTML-flagged anyway).
  if (element.localName === new_name.toLowerCase()) {
    return element;
  }

  // We do not know if the document in which the element resides is the same
  // document as the one executing this function. For security, we make sure to
  // use the element's own document to create the new element. This also avoids
  // any possible performance overhead with the implied node adoption process
  // that would occur if copying from this script document into the element's
  // document when the two are different documents.
  //
  // Note that we do not attach the new element to the DOM yet. First we do
  // some other operations that could incur dom overhead (like CSS restyling)
  // if the new element were attached.
  const new_element = element.ownerDocument.createElement(new_name);

  // We will be removing the old element prior to attaching the new element we
  // will create, so we need to cache the reference to the old element's parent
  // prior to removal.
  const parent = element.parentNode;

  // Disregard and noop attempts to rename an element that resides at the root
  // of a detached subtree (aka an orphan). We have no parent upon which to call
  // insertBefore. This does not constitute a programmer error because typically
  // the caller will not bother to discern this facet prior to the call, it
  // would increase caller boilerplate to the point where it becomes annoying to
  // call, and because the input element parameter often comes from user
  // generated content and not developer content.
  if (!parent) {
    return element;
  }

  // We want to place the new element into the same position as the old element
  // later using insertBefore, which can easily be done by knowing the parent
  // element and the next adjacent node (if one exists). However, we plan to
  // remove the old element prior to attaching the new element, and the link to
  // nextSibling will be destroyed when removing the old element. Therefore we
  // keep around the old reference prior to detachment. Note that this value may
  // be undefined, which is fine, due to how the later call to insertBefore
  // behaves when its second argument is undefined.
  const next_sibling = element.nextSibling;

  // Detach the old element prior to moving child nodes from the old element to
  // the new element. We could do this later, but we are naive regarding whether
  // the element's document is inert or live. If live, it is better performance
  // to move descendants while in the detached state. If inert, it is
  // immaterial.
  element.remove();

  // Copy attributes from source to destination, regardless of whether the
  // attributes are valid for the new element. That is left to the caller.
  const names = element.getAttributeNames();
  for (const name of names) {
    new_element.setAttribute(name, element.getAttribute(name));
  }

  // TODO: consider only moving child nodes if the input element is also not a
  // void element. Basically we really want to avoid iteration over child nodes
  // unless we need to do so.

  // Void elements are those elements we know should not have any child nodes.
  const void_elements = [
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
    'param', 'source', 'track', 'wbr'
  ];

  // We only move child nodes if the new element does not look like a void
  // element.
  if (!void_elements.includes(new_element.localName)) {
    // Move the nodes one at a time, maintaining order. It might be confusing,
    // but essentially each iteration move causes firstChild to shift to the
    // next node implicitly.
    for (let node = element.firstChild; node; node = element.firstChild) {
      new_element.appendChild(node);
    }
  }

  // Insert the new element into the element's owner document in the same
  // position as the old node, and return the new element. Note that if the
  // next sibling is undefined, insertBefore behaves like appendChild, which
  // places the new element as the last child of the parent.
  return parent.insertBefore(new_element, next_sibling);
}
