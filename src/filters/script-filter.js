// Removes script elements from document content

import assert from "/src/assert.js";

export default function filter(doc) {
  assert(doc instanceof Document);

  const scripts = doc.querySelectorAll('script');
  for(const script of scripts) {
    script.remove();
  }
}
