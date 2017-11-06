'use strict';

// import rbl.js

// Look for all <hr><hr> sequences and remove the second one. Naive in that it
// does not fully account for new document state as hrs removed.
function hrFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const hrs = doc.body.querySelectorAll('hr + hr');
  for(const hr of hrs) {
    hr.remove();
  }
}
