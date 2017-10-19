'use strict';

// import assert.js

function ping_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[ping]');
  for(const anchor of anchors) {
    anchor.removeAttribute('ping');
  }
}
