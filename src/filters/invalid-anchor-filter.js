
import assert from "/src/assert.js";

export default function invalidAnchorFilter(doc) {
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
