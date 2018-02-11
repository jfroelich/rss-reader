// Replace entities with utf8 characters to reduce byte size
export function entityDecodeFilter(doc) {
  assert(doc instanceof Document);

  if (!doc.body) {
    return;
  }

  throw new Error('Not implemented');
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
