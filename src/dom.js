// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// DOM utilities

// Moves source's child nodes to destination. Assumes source and destination
// are defined elements.
// TODO: consider renaming to dom_move_children
function dom_append_children(sourceElement, destinationElement) {
  'use strict';

  // Copy the source element's nodes into a document fragment before moving
  // them. This yields an incredible performance improvement because all of
  // the appending takes place in a single append of the fragment into the
  // destination.
  // Create the fragment using the source document. This way the appends
  // into the fragment are not doing anything funky like eager evaluation of
  // scripts. Although I am not sure if this matters because append's behavior
  // may change in the context of a fragment.
  const sourceDocument = sourceElement.ownerDocument;
  const fragment = sourceDocument.createDocumentFragment();

  // Next, move the source element's child nodes into the fragment. We are
  // still in an inert context so we are not yet touching the live dom. This
  // repeatedly accesses parentNode.firstChild instead of childNode.nextSibling
  // because each append removes the childNode and shifts firstChild to
  // nextSibling for us.
  // TODO: if we parse into a frag before sanitize and accept the frag as
  // input, i could skip this step? Would it be better to skip?
  // In fact, wouldn't it make sense to always use a document fragment instead
  // of a full document? frags are lightweight document containers after all.
  // but then i still have to think about how to move over just children of
  // the body. i suppose i could just move those into a frag at the start.
  for(let node = sourceElement.firstChild; node;
    node = sourceElement.firstChild) {
    fragment.appendChild(node);
  }

  // Append everything to the live document all at once. This is when
  // all the script evaluation and computed styling and repaints occur.
  // There is no need to use 'adoptNode' or 'importNode'. The transfer
  // of a node between document contexts is done implicitly by appendChild.
  // This is where XSS happens. This is where Chrome eagerly prefetches images.
  // And as a result of that, this is also where pre-fetch errors occur. For
  // example, Chrome reports an error if a srcset attribute value has invalid
  // syntax.
  destinationElement.appendChild(fragment);
}

// NOTE: this assumes both nodes in the same document and that it is inert.
// TODO: would using fragment here also improve performance?
function dom_insert_children_before(parentNode, referenceNode) {
  'use strict';
  const referenceParent = referenceNode.parentNode;
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    referenceParent.insertBefore(node, referenceNode);
  }
}

// Moves the element's child nodes into the element's or the parent of the
// alternate element if defined, and then removes the element.
// referenceNode is optional.
// TODO: make the space wrapping optional or give caller the responsibility
function dom_unwrap(element, referenceNode) {
  'use strict';
  const target = referenceNode || element;
  const parent = target.parentNode;
  if(parent) {
    const document = element.ownerDocument;

    const prevSibling = target.previousSibling;
    if(prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
      parent.insertBefore(document.createTextNode(' '), target);
    }

    dom_insert_children_before(element, target);

    const nextSibling = target.nextSibling;
    if(nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
      parent.insertBefore(document.createTextNode(' '), target);
    }

    target.remove();
  }
}

// Returns the value of a dom text node
function dom_get_node_value(textNode) {
  'use strict';
  return textNode.nodeValue;
}

function dom_hide_element(element) {
  'use strict';
  element.style.display = 'none';
}

function dom_show_element(element) {
  'use strict';
  element.style.display = 'block';
}

function dom_add_class(element, classNameString) {
  'use strict';
  element.classList.add(classNameString);
}

function dom_remove_class(element, classNameString) {
  'use strict';
  element.classList.remove(classNameString);
}

function dom_is_element_visible(element) {
  'use strict';
  return element.style.display === 'block';
}
