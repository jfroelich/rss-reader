'use strict';

function figure_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  // Unwrap captionless figures. Any figure with only 1 child has either only
  // a caption or only an image or something else, rendering it meaningless
  const figures = doc.body.querySelectorAll('figure');
  for(const figure of figures) {
    if(figure.childElementCount === 1) {
      unwrap_element(figure);
    }
  }
}
