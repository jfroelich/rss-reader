// Adapted from https://github.com/kangax/html-minifier/issues/63
const booleanAttributeNames = [
  'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'compact', 'controls', 'declare',
  'default', 'defaultchecked', 'defaultmuted', 'defaultselected', 'defer', 'disabled', 'draggable',
  'enabled', 'formnovalidate', 'hidden', 'indeterminate', 'inert', 'ismap', 'itemscope', 'loop',
  'multiple', 'muted', 'nohref', 'noresize', 'noshade', 'novalidate', 'nowrap', 'open',
  'pauseonexit', 'readonly', 'required', 'reversed', 'scoped', 'seamless', 'selected', 'sortable',
  'spellcheck', 'translate', 'truespeed', 'typemustmatch', 'visible'
];

export default function removeEmptyAttributes(document) {
  const elements = document.querySelectorAll('*');
  for (const element of elements) {
    const names = element.getAttributeNames();
    for (const name of names) {
      if (!booleanAttributeNames.includes(name)) {
        const value = element.getAttribute(name);
        if (!value || !value.trim()) {
          element.removeAttribute(name);
        }
      }
    }
  }
}
