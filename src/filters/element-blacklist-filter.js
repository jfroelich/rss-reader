
import {assert} from "/src/assert.js";

const BLACKLIST_FILTER_SELECTOR = [
  'applet', 'audio', 'basefont', 'bgsound', 'command', 'datalist', 'dialog', 'embed', 'head',
  'isindex', 'link', 'math', 'meta', 'object', 'output', 'param', 'path', 'progress', 'spacer',
  'style', 'svg', 'title', 'video', 'xmp'
].join(',');

export function elementBlacklistFilter(doc) {
  assert(doc instanceof Document);
  const documentElement = doc.documentElement;
  const elements = doc.querySelectorAll(BLACKLIST_FILTER_SELECTOR);

  for(const element of elements) {
    if(documentElement.contains(element)) {
      element.remove();
    }
  }
}
