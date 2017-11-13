
import {assert} from "/src/rbl.js";

export function scriptFilter(doc) {
  assert(doc instanceof Document);

  const scripts = doc.querySelectorAll('script');
  for(const script of scripts) {
    script.remove();
  }
}
