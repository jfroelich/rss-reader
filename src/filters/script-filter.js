
import assert from "/src/assert.js";

export function scriptFilter(doc) {
  assert(doc instanceof Document);

  const scripts = doc.querySelectorAll('script');
  for(const script of scripts) {
    script.remove();
  }
}
