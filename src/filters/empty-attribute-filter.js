import assert from "/src/assert/assert.js";

export default function filterDocument(document) {
  assert(document instanceof Document);

  if(!document.body) {
    return;
  }

  const elements = document.body.getElementsByTagName('*');
  for(const element of elements) {
    filterElement(element);
  }
}

function filterElement(element) {
  const names = element.getAttributeNames();
  for(const name of names) {
    if(!isBooleanAttribute(element, name)) {
      const value = element.getAttribute(name);
      if(!value.trim()) {
        // console.debug('Removing attribute "%s"', name, element.outerHTML);
        element.removeAttribute(name);
      }
    }
  }
}

// Adapted from https://github.com/kangax/html-minifier/issues/63
const booleanAttributeNames = [
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'compact',
  'controls',
  'declare',
  'default',
  'defaultchecked',
  'defaultmuted',
  'defaultselected',
  'defer',
  'disabled',
  'draggable',
  'enabled',
  'formnovalidate',
  'hidden',
  'indeterminate',
  'inert',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nohref',
  'noresize',
  'noshade',
  'novalidate',
  'nowrap',
  'open',
  'pauseonexit',
  'readonly',
  'required',
  'reversed',
  'scoped',
  'seamless',
  'selected',
  'sortable',
  'spellcheck',
  'translate',
  'truespeed',
  'typemustmatch',
  'visible'
];

export function isBooleanAttribute(element, name) {
  return booleanAttributeNames.includes(name);
}
