const blacklisted_element_selector = [
  'applet', 'audio',  'basefont', 'bgsound', 'command', 'datalist',
  'dialog', 'embed',  'head',     'isindex', 'link',    'math',
  'meta',   'object', 'output',   'param',   'path',    'progress',
  'spacer', 'style',  'svg',      'title',   'video',   'xmp'
].join(',');

// Filters blacklisted elements from document content.
// Not limited to body.

export function filter_blacklisted_elements(document) {
  const document_element = document.documentElement;
  const elements = document.querySelectorAll(blacklisted_element_selector);
  for (const element of elements) {
    if (document_element.contains(element)) {
      element.remove();
    }
  }
}
