// Filters certain types of elements from document content

import assert from "/src/assert.js";

const BLACKLIST = [
  'applet', 'audio', 'basefont', 'bgsound', 'command', 'datalist', 'dialog', 'embed', 'head',
  'isindex', 'link', 'math', 'meta', 'object', 'output', 'param', 'path', 'progress', 'spacer',
  'style', 'svg', 'title', 'video', 'xmp'
].join(',');

export default function elementBlacklistFilter(doc) {
  assert(doc instanceof Document);
  const documentElement = doc.documentElement;
  const elements = doc.querySelectorAll(BLACKLIST);

  for(const element of elements) {
    if(documentElement.contains(element)) {
      element.remove();
    }
  }
}
