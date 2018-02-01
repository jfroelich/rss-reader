
// TODO: filter processing instruction.
// Tentatively I think to do this, can get by node.nodeType.
// Which means I can probably use document.createNodeIterator with a
// node filter test that only returns true for
// Node.PROCESSING_INSTRUCTION_NODE (value of 7)

// TODO: filter doctype?

// Removes processing instruction nodes from a document
export function procInstFilter(document) {
  assert(document instanceof Document);
  throw new Error('Not implemented');
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
