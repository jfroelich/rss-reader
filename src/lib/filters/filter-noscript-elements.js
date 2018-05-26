import {element_unwrap} from '/src/lib/dom/element-unwrap.js';

// TODO: this is revealing a ton of garbage and generally not helping, maybe it
// is better to go back to removal? But if I do removal how do I still support
// information-revealing sizes?

// NOTE: for some reason I see a lot of un-encoded entities in plain noscript
// content. Review whether I am missing something.

// Transforms noscript elements
export function filter_noscript_elements(document) {
  if (document.body) {
    const noscripts = document.body.querySelectorAll('noscript');
    for (const noscript of noscripts) {
      element_unwrap(noscript);
    }
  }
}
