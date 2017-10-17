// rel="noreferrer"
// See also:
// http://w3c.github.io/html/links.html#link-type-noreferrer
// https://blog.fastmail.com/2016/06/20/everything-you-could-ever-want-to-know-and-more-about-controlling-the-referer-header/

'use strict';

// Dependencies:
// assert.js

// TODO: this conflicts with attribute filter. Need to whitelist this
// attribute and this value for this element.

function noreferrer_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }
  // Using getElementsByTagName over querySelectorAll for alleged speed and
  // because this does not remove elements while iterating

  const anchors = doc.body.getElementsByTagName('a');
  for(const anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }
}
