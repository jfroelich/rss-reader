import assert from "/src/assert/assert.js";

// Filters certain anchors from document content
// This is a largely a hack for a particular feed I subscribe to uses something along the lines of
// placeholder urls in the content, but because script is not evaluated elsewhere the bad urls
// all stay and this causes issues elsewhere and broken links.

export default function filterDocument(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a');
  for(const anchor of anchors) {
    if(isInvalidAnchor(anchor)) {
      anchor.remove();
    }
  }
}

function isInvalidAnchor(anchor) {
  const hrefValue = anchor.getAttribute('href');
  return hrefValue && /^\s*https?:\/\/#/i.test(hrefValue);
}
