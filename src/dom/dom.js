// Returns true if the image element has at least one source
export function image_has_source(image) {
  if (has_attr_val(image, 'src') || has_attr_val(image, 'srcset')) {
    return true;
  }

  const picture = image.closest('picture');
  if (picture) {
    const sources = picture.getElementsByTagName('source');
    for (const source of sources) {
      if (has_attr_val(source, 'src') || has_attr_val(source, 'srcset')) {
        return true;
      }
    }
  }

  return false;
}

function has_attr_val(element, attr_name) {
  const value = element.getAttribute(attr_name);
  return (value && value.trim()) ? true : false;
}

// https://github.com/kangax/html-minifier/issues/63
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

export function is_boolean_attribute(element, attribute_name) {
  return attr_names.includes(attribute_name);
}

// Detach an image along with some of its dependencies
export function remove_image(image) {
  if (!image.parentNode) {
    return;
  }

  const figure = image.parentNode.closest('figure');
  if (figure) {
    const captions = figure.querySelectorAll('figcaption');
    for (const caption of captions) {
      caption.remove();
    }

    unwrap_element(figure);
  }

  const picture = image.parentNode.closest('picture');
  if (picture) {
    const sources = picture.querySelectorAll('source');
    for (const source of sources) {
      source.remove();
    }

    unwrap_element(picture);
  }

  image.remove();
}

// Replace |element| with its child nodes. If |nag| is true then warn when
// unwrapping an orphaned node. |nag| is optional, defaults to true.
export function unwrap_element(element, nag = true) {
  // Unwrapping an orphaned node is pointless. Rather than error, just exit
  // early for caller convenience.
  if (!element.parentNode) {
    // Encourage the caller to change their behavior
    if (nag) {
      console.warn('Tried to unwrap orphaned element', element.outerHTML);
    }
    return;
  }

  const owner = element.ownerDocument;
  const parent = element.parentNode;
  const psib = element.previousSibling;
  const nsib = element.nextSibling;
  const fchild = element.firstChild;
  const lchild = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = owner.createDocumentFragment();

  element.remove();

  // TODO: what if the preceding text ends in whitespace, or the trailing text
  // starts with whitespace? should unwrap not append in that case? or what
  // if the text within the element starts or ends in whitespace?

  if (psib && fchild && psib.nodeType === TEXT && fchild.nodeType === TEXT) {
    frag.appendChild(owner.createTextNode(' '));
  }

  for (let node = fchild; node; node = element.firstChild) {
    frag.appendChild(node);
  }

  if (lchild && nsib && nsib.nodeType === TEXT && lchild.nodeType === TEXT) {
    frag.appendChild(owner.createTextNode(' '));
  }

  // Create one trailing space if the element was empty between two text nodes.
  // If an element is empty then its firstChild is falsy (and its lastChild is
  // also falsy).
  if (!fchild && psib && nsib && psib.nodeType === TEXT &&
      nsib.nodeType === TEXT) {
    frag.appendChild(owner.createTextNode(' '));
  }

  parent.insertBefore(frag, nsib);
}
