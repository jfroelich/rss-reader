'use strict';

// import rbl.js

function pingFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[ping]');
  for(const anchor of anchors) {
    anchor.removeAttribute('ping');
  }
}
