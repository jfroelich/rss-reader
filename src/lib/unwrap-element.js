// Replace |element| with its child nodes
export function unwrap_element(element) {
  if (!element.parentNode) {
    return;
  }

  const doc = element.ownerDocument;
  const parent = element.parentNode;
  const prev = element.previousSibling;
  const next = element.nextSibling;
  const first = element.firstChild;
  const last = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = doc.createDocumentFragment();
  const is_table = element.localName === 'table';
  const is_list = ['dl', 'ol', 'ul'].includes(element.localName);

  // Detach upfront in case of live dom
  element.remove();

  if (is_table || is_list) {
    frag.appendChild(doc.createTextNode(' '));
  } else if (
      prev && prev.nodeType === TEXT && first && first.nodeType === TEXT) {
    frag.appendChild(doc.createTextNode(' '));
  }

  // Move the child content into the fragment
  // TODO: does for..of work on element.rows and element.rows[n].cells?
  if (is_table) {
    for (let i = 0; i < element.rows.length; i++) {
      for (let j = 0, row = element.rows[i]; j < row.cells.length; j++) {
        for (let cell = row.cells[j], node = cell.firstChild; node;
             node = cell.firstChild) {
          frag.appendChild(node);
        }
      }
    }
  } else if (is_list) {
    // NOTE: we move along items using sibling chain, because we are moving
    // around the content within items, not the items themselves. Previously
    // this was a bug.
    let item = element.firstChild;
    while (item) {
      if (is_list_item(item)) {
        // Unlike the outer loop, here firstChild does change each move
        for (let child = item.firstChild; child; child = item.firstChild) {
          frag.appendChild(child);
          frag.appendChild(doc.createTextNode(' '));
        }
        // Advance after, since we can, and it is simpler
        item = item.nextSibling;
      } else {
        // Advance before, because we are moving the whole thing, and the
        // nextSibling link will be broken by the move. Memoize the link before
        // however so we can move it after advance.
        const prev = item;
        item = item.nextSibling;
        // For non-item child node of list element, move the entire thing
        frag.appendChild(prev);
      }
    }
  } else {
    for (let node = element.firstChild; node; node = element.firstChild) {
      frag.appendChild(node);
    }
  }

  if (is_table || is_list) {
    frag.appendChild(doc.createTextNode(' '));
  } else if (last && next && next.nodeType === TEXT && last.nodeType === TEXT) {
    frag.appendChild(doc.createTextNode(' '));
  }

  // Create one space if the element was empty between two text nodes
  if (!first && prev && next && prev.nodeType === TEXT &&
      next.nodeType === TEXT) {
    frag.appendChild(doc.createTextNode(' '));
  }

  parent.insertBefore(frag, next);
}
