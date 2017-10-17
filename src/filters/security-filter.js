'use strict';

// Dependencies
// assert.js
// transform-helpers.js // for unwrap_element
// url.js


function security_filter(doc) {
  ASSERT(doc);

  security_filter_apply_blacklist(doc);
  security_filter_unwrap_script_anchors(doc);
}




const SECURITY_FILTER_BLACKLIST = [
  'applet', 'audio', 'basefont', 'bgsound',  'command',
  'datalist', 'dialog', 'embed', 'head',
  'isindex', 'link', 'math', 'meta',
  'object', 'output',  'param', 'path', 'progress',
  'spacer', 'style', 'svg', 'title',
  'video', 'xmp'
];

const SECURITY_FILTER_BLACKLIST_SELECTOR = SECURITY_FILTER_BLACKLIST.join(',');

function security_filter_apply_blacklist(doc) {
  const doc_element = doc.documentElement;
  const elements = doc.querySelectorAll(SECURITY_FILTER_BLACKLIST_SELECTOR);

  // The contains check avoids affecting elements that are descendants of
  // of elements removed in a prior iteration of the loop. The cost of the
  // contains lookup is less than the cost of the remove.

  for(const element of elements) {
    if(doc_element.contains(element))
      element.remove();
  }
}

function security_filter_unwrap_script_anchors(doc) {
  // We only care about displayable anchors, and as far as I know, only
  // anchors in body are displayable.
  if(!doc.body)
    return;

  const anchors = doc.body.querySelectorAll('a');
  for(const anchor of anchors) {
    if(url_is_script(anchor.getAttribute('href')))
      unwrap_element(anchor);
  }
}
