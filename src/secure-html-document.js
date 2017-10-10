'use strict';

(function(exports){

// TODO: maybe unwrap any non-whitelisted elements?

function secure_html_document(doc) {
  unwrap_noscript_elements(doc);
  remove_script_elements(doc);
  remove_blacklisted_elements(doc);
  unwrap_script_url_anchors(doc);
}

function unwrap_noscript_elements(doc) {
  const elements = doc.querySelectorAll('noscript');
  for(const element of elements)
    unwrap_element(element);
}

function remove_script_elements(doc) {
  // Not restricted to body or head, script can be anywhere
  const elements = doc.querySelectorAll('script');
  for(const element of elements)
    element.remove();
}

// TODO: only remove elements related to security, create another function
// in sanitize that does the rest
// TODO: do not handle elements handled by other special functions
// better svg and math processing
function remove_blacklisted_elements(doc) {
  const blacklist = [
    'applet', 'audio', 'base', 'basefont', 'bgsound',  'command',
    'datalist', 'dialog', 'embed', 'head',
    'isindex', 'link', 'math', 'meta',
    'object', 'output',  'param', 'path', 'progress',
    'spacer', 'style', 'svg', 'title',
    'video', 'xmp'
  ];

  const selector = blacklist.join(',');
  const doc_element = doc.documentElement;
  const elements = doc.querySelectorAll(selector);
  for(const element of elements)
    if(doc_element.contains(element))
      element.remove();
}

function unwrap_script_url_anchors(doc) {
  const anchors = doc.querySelectorAll('a');
  for(const anchor of anchors)
    if(is_script_url(anchor.getAttribute('href')))
      unwrap_element(anchor);
}

function is_script_url(url_string) {
  return url_string && url_string.length > 11 &&
    /^\s*javascript:/i.test(url_string);
}

exports.secure_html_document = secure_html_document;

}(this));
