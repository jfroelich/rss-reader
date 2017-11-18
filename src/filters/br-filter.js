
import assert from "/src/assert.js";

export default function brFilter(doc) {
  assert(doc instanceof Document);
  if(doc.body) {
    const brs = doc.body.querySelectorAll('br + br');
    for(const br of brs) {
      br.remove();
    }
  }
}
