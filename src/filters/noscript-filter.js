// noscript element lib

'use strict';

// Dependencies:
// assert.js
// transform-helpers.js

// TODO: Look into whether I can make a more educated guess about whether to
// unwrap or to remove. For example, maybe if there is only one noscript tag
// found, or if the number of elements outside of the node script but within
// the body is above or below some threshold (which may need to be relative
// to the total number of elements within the body?)
// One of the bigger issues is that I show a lot of junk in the output. Maybe
// the boilerplate filtering should be picking it up, but right now it doesn't.
// TODO: move into hidden-filter, along with the code in sanity-filter that
// does visibility related stuff. This is less about security and more about
//visibility.

function noscript_filter(doc) {
  const noscripts = doc.querySelectorAll('noscript');
  for(const noscript of noscripts) {
    unwrap_element(noscript);
  }
}
