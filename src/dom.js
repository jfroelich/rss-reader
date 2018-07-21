// The DOM library provides some helpful functions for interacting with a
// document object model.

// Renames an element. Retains child nodes unless the node is void. Event
// listeners are not retained.
export function coerce_element(element, new_name, copy_attributes = true) {
  const parent_element = element.parentNode;
  if (!parent_element) {
    return element;
  }

  // Avoid things like createElement(null) producing <null>
  if (!is_valid_element_name(new_name)) {
    throw new TypeError('Invalid new name ' + new_name);
  }

  if (element.localName === new_name.toLowerCase()) {
    return element;
  }

  const next_sibling = element.nextSibling;
  element.remove();
  // XSS: use the element's document to create the new element
  const new_element = element.ownerDocument.createElement(new_name);

  if (copy_attributes) {
    copy_element_attributes(element, new_element);
  }

  if (!is_void_element(new_element)) {
    move_child_nodes(element, new_element);
  }

  return parent_element.insertBefore(new_element, next_sibling);
}

// Move child nodes from src to destination, maintaining order
function move_child_nodes(from_element, to_element) {
  let node = from_element.firstChild;
  while (node) {
    to_element.appendChild(node);
    // The append shifted so firstChild changed
    node = from_element.firstChild;
  }
}

// https://html.spec.whatwg.org/multipage/syntax.html#void-elements
const void_elements = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
];

export function is_void_element(element) {
  return void_elements.includes(element.localName);
}

// TODO: research what characters are allowed in an element's name
function is_valid_element_name(value) {
  return value && typeof value === 'string' && !value.includes(' ');
}

export function copy_element_attributes(from_element, to_element) {
  const names = from_element.getAttributeNames();
  for (const name of names) {
    to_element.setAttribute(name, from_element.getAttribute(name));
  }
}

// Duration and delay can be floats
export function fade_element(element, duration_secs, delay_secs) {
  return new Promise((resolve, reject) => {
    if (!element) {
      return reject(new Error('Invalid element ' + element));
    }

    if (!element.style) {
      return reject(new Error('Cannot fade element without a style property'));
    }

    duration_secs = isNaN(duration_secs) ? 1 : duration_secs;
    delay_secs = isNaN(delay_secs) ? 0 : delay_secs;

    const style = element.style;
    if (style.display === 'none') {
      // If the element is hidden, it may not have an opacity set. When fading
      // in the element by setting opacity to 1, it has to change from 0 to
      // work.
      style.opacity = '0';

      // If the element is hidden, and its opacity is 0, make it eventually
      // visible
      style.display = 'block';
    } else {
      // If the element is visible, and we plan to hide it by setting its
      // opacity to 0, it has to change from opacity 1 for fade to work
      style.opacity = '1';
    }

    element.addEventListener('webkitTransitionEnd', resolve, {once: true});
    style.transition = `opacity ${duration_secs}s ease ${delay_secs}s`;
    style.opacity = style.opacity === '1' ? '0' : '1';
  });
}

// Returns true if the image element has at least one source, which could be a
// src attribute, a srcset attribute, or an associate picture element with one
// or more source elements that has a src or srcset attribute. This does not
// check whether the urls are syntactically correct, but this does check that an
// attribue value is not empty after trimming.
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

// Replace an element with its child nodes. Special care is taken to add
// whitespace if the operation would result in adjacent text nodes. The element
// should be attached (it should be a node, or a descendant of a node, that is
// in the document).
export function unwrap_element(element) {
  if (!(element instanceof Element)) {
    throw new TypeError('element is not an element');
  }

  // An orphaned node is any parentless node. An orphaned node is obviously
  // detached from the document, as all attached nodes have a parent. There is
  // generally no benefit to unwrapping orphans.
  //
  // Although attempting to unwrap an orphaned node should probably represent a
  // programming error, and so in some sense this case should never be true,
  // just exit early. Encourage the caller to change their behavior.
  if (!element.parentNode) {
    console.warn('Tried to unwrap orphaned element', element.outerHTML);
    return;
  }

  // Cache stuff prior to removal
  const parent_element = element.parentNode;
  const psib = element.previousSibling;
  const nsib = element.nextSibling;
  const fchild = element.firstChild;
  const lchild = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = element.ownerDocument.createDocumentFragment();

  // Detach upfront for O(2) live dom ops, compared to O(n-children) otherwise
  element.remove();

  // Add leading padding
  if (psib && psib.nodeType === TEXT && fchild && fchild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // Move children to fragment, maintaining order
  for (let node = fchild; node; node = element.firstChild) {
    frag.appendChild(node);
  }

  // Add trailing padding
  if (lchild && fchild !== lchild && nsib && nsib.nodeType === TEXT &&
      lchild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // If nsib is undefined then insertBefore appends
  parent_element.insertBefore(frag, nsib);
}
