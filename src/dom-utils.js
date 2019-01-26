import '/third-party/parse-srcset.js';
import '/third-party/tinycolor-min.js';
import assert from '/src/assert.js';

export function is_list_item(node) {
  return ['li', 'dd', 'dt'].includes(node.localName);
}

export function element_derive_text_color(element) {
  const style = getComputedStyle(element);
  if (style) {
    const color_value = css_color_parse(style.color);
    if (typeof color_value !== 'undefined') {
      return color_value;
    }
  }
  return color.BLACK;
}

export function element_derive_background_color(element, matte) {
  const include_self = true;
  const layers = element_ancestors(element, include_self);
  const colors = layers.map(element_derive_background_color_inline);
  return color.blend(colors.reverse(), matte);
}

export function element_derive_background_color_inline(element) {
  // TODO: if opacity is not a channel in the color, then should this not also
  // consider the opacity css property?

  const style = element.style;
  if (style) {
    const css_bgcolor = style.backgroundColor;
    if (css_bgcolor) {
      const color_value = css_color_parse(css_bgcolor);
      if (color_value) {
        return color_value;
      }
    }
  }
  return color.TRANSPARENT;
}

export function element_ancestors(element, include_self) {
  const layers = [];
  let node = include_self ? element : element.parentNode;
  while (node) {
    layers.push(node);
    node = node.parentNode;
  }
  return layers;
}


// Parses a css color value into a color
export function css_color_parse(value) {
  if (typeof value === 'string' && value.length) {
    const tc = new tinycolor(value);
    if (tc.isValid()) {
      return tinycolor_to_color(tc);
    }
  }
}

export function tinycolor_to_color(tiny_color) {
  const o = tiny_color.toRgb();
  return color.pack(o.r, o.g, o.b, (o.a * 255) | 0);
}

export function css_color_format(value) {
  return 'rgba(' + color.get_red(value) + ', ' + color.get_green(value) + ', ' +
      color.get_blue(value) + ', ' + color.get_alpha(value) / 255 + ')';
}

const leaf_exception_element_names = [
  'area', 'audio',  'base', 'col',      'command', 'br',    'canvas', 'col',
  'hr',   'iframe', 'img',  'input',    'keygen',  'meta',  'nobr',   'param',
  'path', 'source', 'sbg',  'textarea', 'track',   'video', 'wbr'
];

// Returns whether the input node is a 'leaf'
export function node_is_leaf(node) {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE: {
      if (is_element_leaf_exception(node)) {
        return false;
      }

      for (let child = node.firstChild; child; child = child.nextSibling) {
        if (!node_is_leaf(child)) {
          return false;
        }
      }

      break;
    }
    case Node.TEXT_NODE:
      return !node.nodeValue.trim();
    case Node.COMMENT_NODE:
      return true;
    default:
      return false;
  }

  return true;
}

function is_element_leaf_exception(element) {
  return leaf_exception_element_names.includes(element.localName);
}

const void_elements = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
];

export function coerce_element(element, new_name, copy_attributes = true) {
  const parent = element.parentNode;
  if (!parent) {
    return element;
  }

  if (!is_valid_element_name(new_name)) {
    throw new TypeError('Invalid new name ' + new_name);
  }

  if (element.localName === new_name.toLowerCase()) {
    return element;
  }

  const next_sibling = element.nextSibling;
  element.remove();
  // XSS: use the element's own document to create the new element
  const new_element = element.ownerDocument.createElement(new_name);

  if (copy_attributes) {
    copy_attrs(element, new_element);
  }

  move_child_nodes(element, new_element);
  return parent.insertBefore(new_element, next_sibling);
}

function move_child_nodes(src, dst) {
  if (!void_elements.includes(dst.localName)) {
    for (let node = src.firstChild; node; node = src.firstChild) {
      dst.appendChild(node);
    }
  }
}

function is_valid_element_name(value) {
  return value && typeof value === 'string' && !value.includes(' ');
}

export function copy_attrs(src, dst) {
  const names = src.getAttributeNames();
  for (const name of names) {
    dst.setAttribute(name, src.getAttribute(name));
  }
}

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

// Parses a value into an array of descriptors. The value should be a string
// representing the contents of an html element srcset attribute value. If the
// input is bad or no descriptors are found then parse returns an empty array.
export function srcset_parse(value) {
  return (value && typeof value === 'string') ? parseSrcset(value) : [];
}

// Convert an array of descriptors into a string. Throws an error if descriptors
// is not an array.
export function srcset_serialize(descriptors) {
  const buf = [];
  for (const descriptor of descriptors) {
    const dbuf = [descriptor.url];
    if (descriptor.d) {
      dbuf.push(' ');
      dbuf.push(descriptor.d);
      dbuf.push('x');
    } else if (descriptor.w) {
      dbuf.push(' ');
      dbuf.push(descriptor.w);
      dbuf.push('w');
    } else if (descriptor.h) {
      dbuf.push(' ');
      dbuf.push(descriptor.h);
      dbuf.push('h');
    }

    const descriptor_string = dbuf.join('');
    buf.push(descriptor_string);
  }

  return buf.join(', ');
}

// Returns true if an element is hidden
export function is_hidden_inline(element) {
  if (element_input_is_hidden(element)) {
    return true;
  }

  const style = element.style;

  // Despite whatever the documentation states, the style property is sometimes
  // not initialized for certain elements such as <math>. This was encountered
  // around Chrome 65 as an uncaught exception.
  if (!style) {
    return false;
  }

  // The style object has a length property that is set to the number of inline
  // properties specified. If it is 0, that means that no inline style
  // properties are specified. I am not sure, but I think it is worth doing this
  // check because it potentially reduces the number of subsequent checks more
  // often than not.
  if (style.length < 1) {
    return false;
  }

  return style.display === 'none' || style.visibility === 'hidden' ||
      element_is_near_transparent(element) || element_is_offscreen(element);
}

// Return whether the element is <input type="hidden">
// TODO: consider element.matches('input[type="hidden"]')?
function element_input_is_hidden(element) {
  const name = element.localName;
  if (name === 'input') {
    const type = element.getAttribute('type');
    if (type && type.trim().toLowerCase() === 'hidden') {
      return true;
    }
  }
  return false;
}

// Returns true if the element's opacity is close to 0 or 0.
function element_is_near_transparent(element) {
  const style = element.style;

  // This time we know style is defined because we expect this to be called
  // exclusively from is_hidden_inline

  // We only care about the case when we are rather sure of transparency. If
  // we cannot determine then we assume the element is opaque and return false.

  // This check is a shortcut to try and avoid the cost of parseFloat.
  // Alternatively we could just let this case get caught with the isNaN check,
  // but that is after the parseFloat call.
  // TODO: but what about style.opacity 0? Is style.opacity a string or a
  // number? I think it is a string so this check is correct but I keep having
  // doubts, so one thing to do would be to explicit comment about it.
  // TODO: consider using the new CSSOM stuff if it is relevant
  if (!style.opacity) {
    return false;
  }

  // TODO: should this be a parameter instead of being hardcoded? In hindsight
  // I think that it is better to let the caller decide.
  const threshold = 0.3;

  // NOTE: parseFloat tolerates units.
  const opacity = parseFloat(style.opacity);
  return !isNaN(opacity) && opacity <= threshold;
}

// Returns true if the element is positioned off screen. Heuristic guess.
// Probably several false negatives, and a few false positives. The cost of
// guessing wrong is not too high. This is inaccurate.
function element_is_offscreen(element) {
  const style = element.style;
  if (style.position === 'absolute') {
    const left = parseInt(style.left, 10);
    if (!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}

// Replace |element| with its child nodes. If |nag| is true then warn when
// unwrapping an orphaned node.
// TODO: what if the preceding text ends in whitespace, or the trailing text
// starts with whitespace? should unwrap not append in that case? or what
// if the text within the element starts or ends in whitespace?
// TODO: we do not need to append a space if the preceding node is a text node
// that ends in a space, and similarly if the subsequent node is a text node
// that starts with a space, we can just let the normalize-text algorithm do
// the merge.
export function unwrap_element(element) {
  if (!element.parentNode) {
    return;
  }

  const doc = element.ownerDocument;
  const parent = element.parentNode;
  const prev = element.previousSibling;
  const next = element.nextSibling;

  // TODO: do these need to be different for a table? They do logically, but
  // does it matter at all? The later code maybe just ignores these for tables.
  const first = element.firstChild;
  const last = element.lastChild;

  const TEXT = Node.TEXT_NODE;
  const frag = doc.createDocumentFragment();

  const is_table = element.localName === 'table';
  const is_list = ['dl', 'ol', 'ul'].includes(element.localName);

  // Detach upfront in case of live dom
  element.remove();

  if (is_table) {
    // For now, just get unwrap handling tables and always append
    frag.appendChild(doc.createTextNode(' '));
  } else if (
      prev && prev.nodeType === TEXT && first &&
      (first.nodeType === TEXT ||
       (is_list && first.nodeType === Node.ELEMENT_NODE && first.firstChild &&
        first.firstChild.nodeType === TEXT))) {
    frag.appendChild(doc.createTextNode(' '));
  }

  // TODO: does for..of work on table.rows and table.rows[n].cells?

  if (is_table) {
    const row_count = table.rows.length;
    for (let i = 0; i < row_count; i++) {
      const row = rows[i];
      for (let j = 0, clen = row.cells.length; j < clen; j++) {
        const cell = row.cells[j];
        for (let node = cell.firstChild; node; node = cell.firstChild) {
          parent.insertBefore(node, table);
        }
      }
    }
  } else if (is_list) {
    for (let node = first; node; node = element.firstChild) {
      if (node.nodeType === Node.ELEMENT_NODE &&
          (node.localName === 'li' || node.localName === 'dd')) {
        for (let item_node = node.firstChild; item_node;
             item_node = node.firstChild) {
          frag.appendChild(item_node);
        }
      } else {
        frag.appendChild(node);
      }
    }
  } else {
    for (let node = first; node; node = element.firstChild) {
      frag.appendChild(node);
    }
  }

  if (is_table) {
    // For now, just get table unwrap working and always append
    frag.appendChild(doc.createTextNode(' '));
  } else if (
      last && next && next.nodeType === TEXT &&
      (last.nodeType === TEXT ||
       (is_list && last.nodeType === Node.ELEMENT_NODE && last.lastChild &&
        list.lastChild.nodeType === TEXT))) {
    frag.appendChild(doc.createTextNode(' '));
  }

  // Create one space if the element was empty between two text nodes. This is
  // separate from the other checks that require at least one child.
  if (!first && prev && next && prev.nodeType === TEXT &&
      next.nodeType === TEXT) {
    frag.appendChild(doc.createTextNode(' '));
  }

  parent.insertBefore(frag, next);
}

export function set_base_uri(document, url, overwrite) {
  assert(typeof document === 'object');
  assert(typeof url === 'object');
  assert(url.href);

  let head = document.querySelector('head');
  const body = document.querySelector('body');

  if (overwrite) {
    // There must be no more than one base element per document.
    const bases = document.querySelectorAll('base');
    for (const base of bases) {
      base.remove();
    }

    const base = document.createElement('base');
    base.setAttribute('href', url.href);

    if (head) {
      // Insert the base as the first element within head. If firstElementChild
      // is undefined, this devolves into appendChild.
      head.insertBefore(base, head.firstElementChild);
    } else {
      head = document.createElement('head');
      // Appending to new head while it is still detached is better performance
      // in case document is live
      head.appendChild(base);
      // Insert the head before the body (fallback to append if body not found)
      document.documentElement.insertBefore(head, body);
    }
    return;
  }

  let base = document.querySelector('base[href]');
  ;
  if (!base) {
    base = document.createElement('base');
    base.setAttribute('href', url.href);
    if (head) {
      head.insertBefore(base, head.firstElementChild);
    } else {
      head = document.createElement('head');
      head.appendChild(base);
      document.documentElement.insertBefore(head, body);
    }
    return;
  }

  // The spec states that "[t]he href content attribute, if specified, must
  // contain a valid URL potentially surrounded by spaces." Rather than
  // explicitly trim, we pass along extraneous whitespace to the URL
  // constructor, which tolerates it. So long as we pass the base parameter
  // to the URL constructor, the URL constructor also tolerates when the first
  // parameter is null or undefined.
  const href_value = base.getAttribute('href');
  const canonical_url = new URL(href_value, url);

  const comparable_href = href_value ? href_value.trim() : '';
  if (canonical_url.href !== comparable_href) {
    // Canonicalization resulted in a material value change. The value change
    // could be as simple as removing spaces, adding a trailing slash, or as
    // complex as making a relative base url absolute with respect to the input
    // url, or turning an empty value into a full url. So we update this first
    // base.
    base.setAttribute('href', canonical_url.href);
  } else {
    // If there was no material change to the value after canonicalization, this
    // means the existing base href value is canonical. Since we are not
    // overwriting at this point, we respect the existing value.
    // Fallthrough
  }

  // Per the spec, "[t]here must be no more than one base element per
  // document." Now that we know which of the existing base elements will be
  // retained, we remove the others to make the document more spec compliant.
  const bases = document.querySelectorAll('base');
  for (const other_base of bases) {
    if (other_base !== base) {
      other_base.remove();
    }
  }
}
