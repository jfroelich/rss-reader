'use strict';

// import base/status.js

function ping_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[ping]');
  for(const anchor of anchors) {
    anchor.removeAttribute('ping');
  }

  return STATUS_OK;
}
