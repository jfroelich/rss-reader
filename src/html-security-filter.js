'use strict';

// Dependencies
// assert.js
// transform-helpers.js // for unwrap_element
// url.js


function html_security_transform_document(doc) {
  ASSERT(doc);
  html_security_unwrap_noscripts(doc);
  html_security_remove_scripts(doc);
  html_security_remove_blacklisted_elements(doc);
  html_security_unwrap_script_anchors(doc);
}

function html_security_unwrap_noscripts(doc) {
  const elements = doc.querySelectorAll('noscript');
  for(const element of elements)
    unwrap_element(element);
}

function html_security_remove_scripts(doc) {
  const elements = doc.querySelectorAll('script');
  for(const element of elements)
    element.remove();
}

const HTML_SECURITY_BLACKLIST = [
  'applet', 'audio', 'base', 'basefont', 'bgsound',  'command',
  'datalist', 'dialog', 'embed', 'head',
  'isindex', 'link', 'math', 'meta',
  'object', 'output',  'param', 'path', 'progress',
  'spacer', 'style', 'svg', 'title',
  'video', 'xmp'
];

const HTML_SECURITY_BLACKLIST_SELECTOR = HTML_SECURITY_BLACKLIST.join(',');

function html_security_remove_blacklisted_elements(doc) {
  const doc_element = doc.documentElement;
  const elements = doc.querySelectorAll(HTML_SECURITY_BLACKLIST_SELECTOR);

  // The contains check avoids affecting elements that are descendants of
  // of elements removed in a prior iteration of the loop. The cost of the
  // contains lookup is less than the cost of the remove.

  for(const element of elements) {
    if(doc_element.contains(element))
      element.remove();
  }
}

function html_security_unwrap_script_anchors(doc) {
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
