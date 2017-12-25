import assert from "/src/utils/assert.js";

// Removes script elements from document content

export default function filter(doc) {
  assert(doc instanceof Document);

  const scripts = doc.querySelectorAll('script');
  for(const script of scripts) {
    script.remove();
  }
}
