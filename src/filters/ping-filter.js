// ping attribute lib

'use strict';

// Dependencies:
// assert.js

function ping_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  // Using getElementsByTagName over querySelectorAll for alleged speed and
  // because this does not remove elements while iterating

  // TODO: actually, this could be improved to select only those
  // anchors that have a ping using querySelectorAll, such as
  // querySelectorAll('a[ping]')

  const anchors = doc.body.getElementsByTagName('a');
  for(const anchor of anchors) {
    anchor.removeAttribute('ping');
  }
}
