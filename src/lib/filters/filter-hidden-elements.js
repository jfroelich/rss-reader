import {element_is_hidden_inline} from '/src/content-filters/utils.js';
import {element_unwrap} from '/src/lib/element-unwrap.js';

// Removes elements that are hidden.
// * Impure. Mutates the document in place for performance.
// * Ignores elements outside of body. Elements outside of body are assumed to
// be hidden or otherwise properly ignored by consumers of a document's content.
// * Rather than some manual walk of the dom tree, which seems like it would be
// fast because it avoids traversing hidden branches, it turns out to be
// substantially faster to iterate over all elements and checking per visit
// whether an element is still present in the tree. I think that the basic
// reason for this is that querySelectorAll and contains are both highly
// optimized, and because more processing occurs in native-land than in js-land.
// At one point this did a walk, unfortunately I've lost sight of that old
// implementation. It would have been nice to keep around for benchmarking.


// TODO: add console parameter
// TODO: fold in low-contrast filter to here. Actually, what should maybe
// happen is that this calls color-contrast-filter, and the color contrast
// filter remains in a separate file. Then transform-document should not call
// color contrast filter directly. Basically pre-compose

export function filter_hidden_elements(document) {
  const body = document.body;
  if (!body) {
    return;
  }

  const elements = body.querySelectorAll('*');
  for (const element of elements) {
    if (body.contains(element) && element_is_hidden_inline(element)) {
      element_unwrap(element);
    }
  }
}
