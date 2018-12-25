// Adapted from https://github.com/kangax/html-minifier/issues/63
const attr_names = [
  'allowfullscreen', 'async',          'autofocus',     'autoplay',
  'checked',         'compact',        'controls',      'declare',
  'default',         'defaultchecked', 'defaultmuted',  'defaultselected',
  'defer',           'disabled',       'draggable',     'enabled',
  'formnovalidate',  'hidden',         'indeterminate', 'inert',
  'ismap',           'itemscope',      'loop',          'multiple',
  'muted',           'nohref',         'noresize',      'noshade',
  'novalidate',      'nowrap',         'open',          'pauseonexit',
  'readonly',        'required',       'reversed',      'scoped',
  'seamless',        'selected',       'sortable',      'spellcheck',
  'translate',       'truespeed',      'typemustmatch', 'visible'
];

// Return true if the given attribute is boolean
export function is_boolean(element, attribute_name) {
  return attr_names.includes(attribute_name);
}
