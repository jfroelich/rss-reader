
import {domUnwrap} from "/src/dom.js";
import {assert} from "/src/rbl.js";

export function noscriptFilter(doc) {
  assert(doc instanceof Document);

  const noscripts = doc.querySelectorAll('noscript');
  for(const noscript of noscripts) {
    domUnwrap(noscript);
  }
}
