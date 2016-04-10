// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// DOM routines

// Appends source's child nodes to destination. The nodes are moved, not
// copied. Assumes source and destination are defined dom nodes.
// This is not optimized for moving attached nodes.
// The order of children is maintained.
// TODO: look into some way of doing this in batch instead of one node at a
// time. I have a feeling the suboptimal performance is because it is doing
// lots of wasted operations. Although actually another part of the reason
// this is slow is because of the possible inert-live transition.
// Using insertAdjacentHTML and innerHTML do not work that well, because
// that requires marshalling/unmarshalling.
function dom_append_children(sourceElement, destinationElement) {
  'use strict';

  // NOTE: this is where nodes in an inert content 'go live'. This is where
  // XSS happens. This is where Chrome eagerly prefetches images. And as a
  // result of that, this is also where pre-fetch errors occur. For example,
  // Chrome reports an error if a srcset attribute value has invalid syntax.

  // NOTE: there is no need to use 'adoptNode' or 'importNode'. The transfer
  // of a node between document contexts is done implicitly by appendChild.

  // TODO: maybe this could just be insertBefore with null as the
  // second argument.
  // That is because insertBefore defaults to appendChild behavior when the
  // second argument is undefined (sort of).
  // Chrome has strange behavior if second
  // argument to insertBefore is undefined (but it works as expected if null).
  // Therefore I think I should deprecate this function and just use
  // dom_insert_children_before.
  // But I can't do this easily, because I use referenceNode.parentNode in
  // dom_insert_children_before. I can't pass null.

  // The confusing part of this is that as each child is appended, it is
  // removed from its previous parent, meaning that the next child becomes the
  // parent.firstChild node. This is why we reassign node to firstChild again
  // and not child.nextSibling.
  for(let node = sourceElement.firstChild; node;
    node = sourceElement.firstChild) {
    destinationElement.appendChild(node);
  }
}

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
function dom_unwrap(element, referenceNode) {
  'use strict';

  const target = referenceNode || element;
  const parent = target.parentNode;
  if(parent) {
    const document = element.ownerDocument;
    const prevSibling = target.previousSibling;
    const nextSibling = target.nextSibling;
    if(prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
      parent.insertBefore(document.createTextNode(' '), target);
    }
    dom_insert_children_before(element, target);
    if(nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
      parent.insertBefore(document.createTextNode(' '), target);
    }
    target.remove();
  }
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
