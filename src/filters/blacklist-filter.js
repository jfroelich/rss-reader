'use strict';

// import "assert.js"

const BLACKLIST_FILTER_SELECTOR = [
  'applet', 'audio', 'basefont', 'bgsound', 'command', 'datalist', 'dialog',
  'embed', 'head', 'isindex', 'link', 'math', 'meta', 'object', 'output',
  'param', 'path', 'progress', 'spacer', 'style', 'svg', 'title', 'video',
  'xmp'
].join(',');

function blacklist_filter(doc) {
  ASSERT(doc);
  const doc_element = doc.documentElement;
  const elements = doc.querySelectorAll(BLACKLIST_FILTER_SELECTOR);

  for(const element of elements) {
    if(doc_element.contains(element)) {
      element.remove();
    }
  }
}
