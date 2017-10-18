
'use strict';

function semantic_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  unwrap_elements(doc.body,
    'article, aside, footer, header, main, section');
}
