import assert from "/src/common/assert.js";

export function procInstFilter(doc) {
  assert(doc instanceof Document);

  // TODO: filter processing instruction.

  // TODO: filter doctype

  // Tentatively I think to do this, can get by node.nodeType.
  // Which means I can probably use doc.createNodeIterator with a
  // node filter test that only returns true for
  // Node.PROCESSING_INSTRUCTION_NODE (value of 7)

  throw new Error('Not implemented');
}