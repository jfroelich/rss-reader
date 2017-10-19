'use strict';

function script_anchor_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a');
  for(const anchor of anchors) {
    if(url_is_script(anchor.getAttribute('href')))
      unwrap_element(anchor);
  }
}
