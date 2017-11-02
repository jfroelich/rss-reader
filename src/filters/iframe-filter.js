'use strict';

// import base/errors.js

function iframeFilter(doc) {
  console.assert(doc instanceof Document);

  // Only look at frames within body. If body not present then nothing to do.
  if(!doc.body) {
    return;
  }

  const iframes = doc.body.querySelectorAll('iframe');
  for(const iframe of iframes) {
    iframe.remove();
  }

  return RDR_OK;
}
