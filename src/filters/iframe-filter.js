'use strict';

// TODO: maybe inline iframes or replace with a message instead of simply
// removing.
// TODO: maybe special case for handling embedded video, and even more specific
// special case for youtube.

// Remove iframes
function iframe_filter(doc) {
  console.assert(doc instanceof Document);

  // Only look at frames within body. If body not present then nothing to do.
  if(!doc.body) {
    return;
  }

  // TODO: reverse iteration over getElementsByTagName might be better
  // perf

  const iframes = doc.body.querySelectorAll('iframe');
  for(const frame of iframes) {
    frame.remove();
  }
}
