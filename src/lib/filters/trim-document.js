
// Remove whitespace and whitespace-like content from the start and end of a
// document's body.
export function trim_document(document) {
  if (document.body) {
    const first_child = document.body.firstChild;
    if (first_child) {
      trim_document_step(first_child, 'nextSibling');
      const last_child = document.body.lastChild;
      if (last_child && last_child !== first_child) {
        trim_document_step(last_child, 'previousSibling');
      }
    }
  }
}

function trim_document_step(start_node, edge_name) {
  let node = start_node;
  while (node && node_is_trimmable(node)) {
    const sibling = node[edge_name];
    node.remove();
    node = sibling;
  }
}

function node_is_trimmable(node) {
  return node.nodeType === Node.TEXT_NODE ?
      !node.nodeValue.trim() :
      ['br', 'hr', 'nobr'].includes(node.localName);
}
