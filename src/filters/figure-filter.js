import assert from "/src/assert/assert.js";
import unwrap from "/src/utils/dom/unwrap-element.js";

// Filters certain figure elements from document content
export default function figureFilter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  // Unwrap captionless figures. Any figure with only 1 child has either only
  // a caption or only an image or something else, rendering it meaningless
  const figures = doc.body.querySelectorAll('figure');
  for(const figure of figures) {
    if(figure.childElementCount === 1) {
      unwrap(figure);
    }
  }
}
