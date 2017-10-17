'use strict';

// Dependencies
// assert.js

const BLACKLIST_FILTER_SELECTOR = [
  'applet', 'audio', 'basefont', 'bgsound',  'command',
  'datalist', 'dialog', 'embed', 'head',
  'isindex', 'link', 'math', 'meta',
  'object', 'output',  'param', 'path', 'progress',
  'spacer', 'style', 'svg', 'title',
  'video', 'xmp'
].join(',');

// TODO: simplify list, create media-filter that handles media elements
// separately from general blacklist
// TODO: like media filter this list should just be broken up in general
// into purpose-oriented components
// TODO: blacklist should be externally configured?
// TODO: this should accept selector as parameter
// TODO: this shouldn't even be a blacklist, it should be
// "remove anything that matches selector"

function blacklist_filter(doc) {
  ASSERT(doc);
  const doc_element = doc.documentElement;
  const elements = doc.querySelectorAll(BLACKLIST_FILTER_SELECTOR);

  // The contains check avoids affecting elements that are descendants of
  // of elements removed in a prior iteration of the loop. The cost of the
  // contains lookup is less than the cost of the remove.

  for(const element of elements) {
    if(doc_element.contains(element)) {
      element.remove();
    }
  }
}
