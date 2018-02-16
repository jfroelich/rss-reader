import {filter_boilerplate} from '/src/content-filters/boilerplate.js';
import {color_contrast_filter} from '/src/content-filters/color-contrast-filter/color-contrast-filter.js';
import {assert, attribute_is_boolean, element_coerce_all, element_is_hidden_inline, element_unwrap, fetch_image_element, file_name_filter_extension, image_has_source, image_remove, parse_srcset_wrapper, srcset_serialize, string_condense_whitespace, url_get_filename, url_is_external, url_string_is_valid, url_string_resolve} from '/src/content-filters/utils.js';

// Removes text classified as boilerplate
// Re-export as if this were inline
// TODO: look into re-export, should not need to wrap
export function cf_filter_boilerplate(document, options) {
  return filter_boilerplate(document, options);
}

// TODO: make this work
// export const cf_filter_low_contrast = color_contrast_filter;

export function cf_filter_low_contrast(document, min_contrast_ratio) {
  return color_contrast_filter(document, min_contrast_ratio);
}

// Removes non-whitelisted attributes from elements
// @param document {Document}
// @param whitelist {Object} each property is element name, each value is array
// of retainable attribute names
export function cf_filter_non_whitelisted_attributes(document, whitelist) {
  assert(typeof whitelist === 'object');
  const elements = document.getElementsByTagName('*');
  for (const element of elements) {
    cf_element_filter_non_whitelisted_attributes(element, whitelist);
  }
}

export function cf_element_filter_non_whitelisted_attributes(
    element, whitelist) {
  const attr_names = element.getAttributeNames();
  if (attr_names.length) {
    const whitelisted_names = whitelist[element.localName] || [];
    for (const attribute_name of attr_names) {
      if (!whitelisted_names.includes(attribute_name)) {
        element.removeAttribute(attribute_name);
      }
    }
  }
}

// Removes, moves, or otherwise changes certain out-of-place elements in
// document content
export function cf_filter_misnested_elements(document) {
  if (!document.body) {
    return;
  }

  // Fix hr in lists. Simple case of invalid parent
  const nested_hr_elements =
      document.body.querySelectorAll('ul > hr, ol > hr, dl > hr');
  for (const hr of nested_hr_elements) {
    hr.remove();
  }

  // Disallow nested anchors. If any anchor has an ancestor anchor, then unwrap
  // the descendant anchor and keep the ancestor.
  const descendant_anchors_of_anchors = document.body.querySelectorAll('a a');
  for (const descendant_anchor of descendant_anchors_of_anchors) {
    element_unwrap(descendant_anchor);
  }

  // Remove figcaption elements not tied to a figure
  const captions = document.body.querySelectorAll('figcaption');
  for (const caption of captions) {
    // We know the current element is not a figure, so speed up closest by
    // starting from parent node, because closest checks self
    if (!caption.parentNode.closest('figure')) {
      caption.remove();
    }
  }

  // Remove source elements not meaningfully tied to an ancestor
  const sources = document.body.querySelectorAll('source');
  for (const source of sources) {
    if (!source.parentNode.closest('audio, picture, video')) {
      source.remove();
    }
  }

  // Relocate some basic occurrences of invalid ancestor
  const block_selector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inline_selector = 'a, span, b, strong, i';

  const blocks = document.body.querySelectorAll(block_selector);
  for (const block of blocks) {
    const ancestor = block.closest(inline_selector);
    if (ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for (let node = block.firstChild; node; node = block.firstChild) {
        ancestor.appendChild(node);
      }
      block.appendChild(ancestor);
    }
  }
}

export function cf_filter_base_elements(document) {
  const bases = document.querySelectorAll('base');
  for (const base of bases) {
    base.remove();
  }
}

export function cf_filter_br_elements(document) {
  if (document.body) {
    const brs = document.body.querySelectorAll('br + br');
    for (const br of brs) {
      br.remove();
    }
  }
}

export function cf_filter_comments(document) {
  const it = document.createNodeIterator(
      document.documentElement, NodeFilter.SHOW_COMMENT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

// Unwraps non-semantic container-like elements
export function filter_container_elements(document) {
  if (document.body) {
    const elements = document.body.querySelectorAll('div, ilayer, layer');
    for (const element of elements) {
      element_unwrap(element);
    }
  }
}

// De-emphasizes text that after removing whitespace is longer than the given
// length
// @param text_length_max {Number} the number of characters above which emphasis
// is removed (exclusive), required, positive integer greater than 0
export function cf_filter_emphasis(document, text_length_max) {
  assert(Number.isInteger(text_length_max) && text_length_max > 0);
  if (document.body) {
    const elements = document.body.querySelectorAll('b, big, em, i, strong');
    for (const element of elements) {
      if (cf_get_emphasis_length(element) > text_length_max) {
        element_unwrap(element);
      }
    }
  }
}

function cf_get_emphasis_length(element) {
  return cf_string_filter_whitespace(element.textContent).length;
}

function cf_string_filter_whitespace(value) {
  return value.replace(/\s+/, '');
}

// Remove captionless figure elements. Well-formed figures have more than one
// child element, one being a caption and one being the captioned element. If
// the figure has no children, it is likely used as merely a formatting element,
// similar to a div, and should be removed. If the figure has only element,
// then it cannot have both a caption and a captioned element, and should
// removed or unwrapped.
export function cf_filter_figures(document) {
  if (document.body) {
    const figures = document.body.querySelectorAll('figure');
    for (const figure of figures) {
      const child_count = figure.childElementCount;
      if (child_count === 1) {
        if (figure.firstElementChild.localName === 'figcaption') {
          figure.remove();
        } else {
          element_unwrap(figure);
        }
      } else if (child_count === 0) {
        element_unwrap(figure);
      }
    }
  }
}

export function cf_ensure_body(document) {
  if (!document.body) {
    const message = 'This document has no content';
    const error_node = document.createTextNode(message);
    const body_element = document.createElement('body');
    body_element.appendChild(error_node);
    document.documentElement.appendChild(body_element);
  }
}

// A string-to-string mapping between names of elements that have an attribute
// that is expected to contain a url, and the name of the element's attribute
// that contains the url
const element_url_attribute_map = {
  a: 'href',
  applet: 'codebase',
  area: 'href',
  audio: 'src',
  base: 'href',
  blockquote: 'cite',
  body: 'background',
  button: 'formaction',
  del: 'cite',
  embed: 'src',
  frame: 'src',
  head: 'profile',
  html: 'manifest',
  iframe: 'src',
  form: 'action',
  img: 'src',
  input: 'src',
  ins: 'cite',
  link: 'href',
  object: 'data',
  q: 'cite',
  script: 'src',
  source: 'src',
  track: 'src',
  video: 'src'
};

// Initialize the selector once on module load
const element_url_attribute_selector = build_resolver_selector();

function build_resolver_selector() {
  const keys = Object.keys(element_url_attribute_map);
  const parts = [];
  for (const key of keys) {
    parts.push(`${key}[${element_url_attribute_map[key]}]`);
  }
  return parts.join(',');
}

// Resolves all attribute values that contain urls
// @param document {Document}
// @param base_url {URL}
export function cf_resolve_document_urls(document, base_url) {
  assert(base_url instanceof URL);

  const src_elements =
      document.querySelectorAll(element_url_attribute_selector);
  for (const src_element of src_elements) {
    element_resolve_attribute(src_element, base_url);
  }

  if (document.body) {
    const elements_with_srcset =
        document.body.querySelectorAll('img[srcset], source[srcset]');
    for (const element_with_srcset of elements_with_srcset) {
      srcset_resolve(element_with_srcset, base_url);
    }
  }
}

function element_resolve_attribute(element, base_url) {
  const attribute_name = element_url_attribute_map[element.localName];
  if (!attribute_name) {
    return;
  }

  const original_url_string = element.getAttribute(attribute_name);
  if (!original_url_string) {
    return;
  }

  const resolved_url = url_string_resolve(original_url_string, base_url);
  if (!resolved_url) {
    return;
  }

  if (resolved_url.href.length !== original_url_string.length) {
    element.setAttribute(attribute_name, resolved_url.href);
  }
}

function srcset_resolve(element, base_url) {
  const srcset_attr_value = element.getAttribute('srcset');
  const descriptors = parse_srcset_wrapper(srcset_attr_value);

  let change_count = 0;
  for (const descriptor of descriptors) {
    const resolved_url = url_string_resolve(descriptor.url, base_url);
    if (resolved_url && resolved_url.href.length !== descriptor.url.length) {
      descriptor.url = resolved_url.href;
      change_count++;
    }
  }

  if (change_count) {
    const new_value = srcset_serialize(descriptors);
    if (new_value) {
      element.setAttribute('srcset', new_value);
    }
  }
}

// Replace certain elements with alternative elements that have names with
// fewer characters
// @param copy_attrs_flag {Boolean} optional, if true then copy attributes
export function cf_condense_tagnames(document, copy_attrs_flag) {
  if (!document.body) {
    return;
  }

  // TODO: inline coerce all
  element_coerce_all(document.body, 'strong', 'b', copy_attrs_flag);
  element_coerce_all(document.body, 'em', 'i', copy_attrs_flag);
}

const blacklisted_element_selector = [
  'applet', 'audio',  'basefont', 'bgsound', 'command', 'datalist',
  'dialog', 'embed',  'head',     'isindex', 'link',    'math',
  'meta',   'object', 'output',   'param',   'path',    'progress',
  'spacer', 'style',  'svg',      'title',   'video',   'xmp'
].join(',');

// Filters blacklisted elements from document content
export function filter_blacklisted_elements(document) {
  const document_element = document.documentElement;
  const elements = document.querySelectorAll(blacklisted_element_selector);
  for (const element of elements) {
    if (document_element.contains(element)) {
      element.remove();
    }
  }
}

export function document_filter_empty_attributes(document) {
  if (document.body) {
    const elements = document.body.getElementsByTagName('*');
    for (const element of elements) {
      element_filter_empty_attributes(element);
    }
  }
}

export function element_filter_empty_attributes(element) {
  // TODO: does getAttributeNames lowercase? Just noticed I assume that it
  // does but never verified
  const names = element.getAttributeNames();
  for (const name of names) {
    if (!attribute_is_boolean(element, name)) {
      const value = element.getAttribute(name);
      if (typeof value !== 'string' || !value.trim()) {
        element.removeAttribute(name);
      }
    }
  }
}

// Filters or transforms certain form elements and form-related elements from
// document content
export function filter_form_elements(document) {
  if (!document.body) {
    return;
  }

  // Unwrap forms
  const forms = document.body.querySelectorAll('form');
  for (const form of forms) {
    element_unwrap(form);
  }

  // Unwrap labels
  const labels = document.body.querySelectorAll('label');
  for (const label of labels) {
    element_unwrap(label);
  }

  // TODO: actually I should be unwrapping fieldset?

  // Remove form fields
  const input_selector =
      'button, fieldset, input, optgroup, option, select, textarea';
  const inputs = document.body.querySelectorAll(input_selector);
  const body = document.body;
  for (const input of inputs) {
    if (body.contains(input)) {
      input.remove();
    }
  }
}

// Unwrap anchors without href attributes
export function filter_formatting_anchors(document) {
  if (document.body) {
    const anchors = document.body.querySelectorAll('a');
    for (const anchor of anchors) {
      if (!anchor.hasAttribute('href')) {
        element_unwrap(anchor);
      }
    }
  }
}

const formatting_elements_selector = [
  'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
  'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink', 'font',
  'plaintext', 'small', 'tt'
].join(',');

// Remove formatting elements
export function filter_formatting_elements(document) {
  if (document.body) {
    const elements =
        document.body.querySelectorAll(formatting_elements_selector);
    for (const element of elements) {
      element_unwrap(element);
    }
  }
}

// Removes frame content from a document
// @param document {Document} the document to inspect and modify
export function filter_frame_elements(document) {
  // If a document is framed then the root frame is its body, and document.body
  // points to it and not some <body> element
  const original_body = document.body;

  // If the document has no body, then there is nothing to do
  if (!original_body) {
    return;
  }

  // If the body element is a body element and not a frame element, then there
  // is nothing to do
  if (original_body.localName !== 'frameset') {
    return;
  }

  // The document is framed, transform into unframed
  const new_body = document.createElement('body');

  // If available, move noframes content into the new body.
  // TODO: support multiple noframes elements
  const noframes_element = document.querySelector('noframes');
  if (noframes_element) {
    for (let node = noframes_element.firstChild; node;
         node = noframes_element.firstChild) {
      new_body.appendChild(node);
    }
  }

  // If the new body is empty, add an error message about framed content
  if (!new_body.firstChild) {
    const error_node =
        document.createTextNode('Unable to display framed document');
    new_body.appendChild(error_node);
  }

  // Replace the old frameset body with the new body
  document.documentElement.replaceChild(new_body, original_body);

  // Remove any frame or frameset elements if somehow any remain
  const frames = document.querySelectorAll('frame, frameset');
  for (const frame of frames) {
    frame.remove();
  }
}

// Filters hidden elements from a document
export function filter_hidden_elements(document) {
  const body = document.body;
  if (!body) {
    return;
  }

  // contains is called to avoid removing descendants of elements detached in
  // prior iterations.
  // This unwraps rather than removes due to progressive content loading
  // techniques. There were too many cases of completely empty documents
  // as a result of removal.

  const elements = body.querySelectorAll('*');
  for (const element of elements) {
    if (body.contains(element) && element_is_hidden_inline(element)) {
      element_unwrap(element);
    }
  }
}

// @param document {Document}
// @param url {URL}
export function filter_by_host_template(document, url) {
  if (!url) {
    return;
  }

  const host_selector_map = {};
  host_selector_map['www.washingtonpost.com'] = [
    'header#wp-header', 'div.top-sharebar-wrapper',
    'div.newsletter-inline-unit', 'div.moat-trackable'
  ];
  host_selector_map['theweek.com'] = ['div#head-wrap'];
  host_selector_map['www.usnews.com'] = ['header.header'];

  const hostname = url.hostname;
  const selectors = host_selector_map[hostname];
  if (!selectors) {
    return;
  }

  const selector = selectors.join(',');
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    element.remove();
  }
}

// Filters certain horizontal rule elements from document content
// Look for all <hr><hr> sequences and remove the second one. Naive in that it
// does not fully account for new document state as hrs removed.
export function filter_hr_elements(document) {
  if (document.body) {
    const hrs = document.body.querySelectorAll('hr + hr');
    for (const hr of hrs) {
      hr.remove();
    }
  }
}

// Removes iframe elements
export function filter_iframe_elements(document) {
  if (document.body) {
    const frames = document.body.querySelectorAll('iframe');
    for (const frame of frames) {
      frame.remove();
    }
  }
}

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this fetches the dimensions
// and modifies each image element's attributes.
// Assumes that if an image has a src attribute value that is a url, that the
// url is absolute.
// @param document {Document}
// @param allowedProtocols {Array} optional, if not provided then defaults
// data/http/https
// @param timeout {Number} optional, if undefined or 0 then no timeout
// @returns {Number} the number of images modified
export async function document_set_image_sizes(document, base_url, timeout) {
  assert(
      base_url === null || typeof base_url === 'undefined' ||
      base_url instanceof URL);
  if (!document.body) {
    return;
  }

  const images = document.body.getElementsByTagName('img');
  if (!images.length) {
    return;
  }

  // Concurrently get dimensions for each image then wait for all to complete
  const promises = [];
  for (const image of images) {
    promises.push(image_get_dimensions(image, base_url, timeout));
  }
  const results = await Promise.all(promises);

  // Update the DOM for images that need state change
  for (const result of results) {
    if ('width' in result) {
      result.image.setAttribute('width', result.width);
      result.image.setAttribute('height', result.height);
    }
  }
}

async function image_get_dimensions(image, base_url, timeout) {
  if (image.hasAttribute('width') && image.hasAttribute('height')) {
    return {image: image, reason: 'has-attributes'};
  }

  let dims = element_get_inline_style_dimensions(image);
  if (dims) {
    return {
      image: image,
      reason: 'inline-style',
      width: dims.width,
      height: dims.height
    };
  }

  const image_source = image.getAttribute('src');
  if (!image_source) {
    return {image: image, reason: 'missing-src'};
  }

  // Parsing the url can throw an error. image_get_dimensions should not throw
  // except in the case of a programming error.
  let source_url;
  try {
    source_url = new URL(image_source, base_url);
  } catch (error) {
    // If we cannot parse the url, then we cannot reliably inspect
    // the url for dimensions, nor fetch the image, so we're done.
    return {image: image, reason: 'invalid-src'};
  }

  dims = url_sniff_dimensions(source_url);
  if (dims) {
    return {
      image: image,
      reason: 'url-sniff',
      width: dims.width,
      height: dims.height
    };
  }

  // Failure to fetch should be trapped, because image_get_dimensions should
  // only throw in case of a programming error, so that it can be used together
  // with Promise.all
  try {
    dims = await fetch_image_element(source_url, timeout);
  } catch (error) {
    return {image: image, reason: 'fetch-error'};
  }

  return {
    image: image,
    reason: 'fetch',
    width: dims.width,
    height: dims.height
  };
}

// Try and find image dimensions from the characters of its url
function url_sniff_dimensions(source_url) {
  // Ignore data urls (will be handled later by fetching)
  if (source_url.protocol === 'data:') {
    return;
  }

  const named_attr_pairs =
      [{width: 'w', height: 'h'}, {width: 'width', height: 'height'}];

  // Infer from url parameters
  const params = source_url.searchParams;
  for (const pair of named_attr_pairs) {
    const width_string = params.get(pair.width);
    if (width_string) {
      const width_int = parseInt(width_string, 10);
      if (!isNaN(width_int)) {
        const height_string = params.get(pair.height);
        if (height_string) {
          const height_int = parseInt(height_string, 10);
          if (!isNaN(height_int)) {
            const dimensions = {};
            dimensions.width = width_int;
            dimensions.height = height_int;
            return dimensions;
          }
        }
      }
    }
  }

  // TODO: implement
  // Grab from file name (e.g. 100x100.jpg => [100,100])
  const file_name = url_get_filename(source_url);
  if (file_name) {
    const partial_file_name = file_name_filter_extension(file_name);
    if (partial_file_name) {
      // not implemented
    }
  }
}

// Try and find dimensions from the style attribute of an image element. This
// does not compute style. This only considers the style attribute itself and
// not inherited styles.
// TODO: this is currently incorrect when width/height are percentage based
function element_get_inline_style_dimensions(element) {
  if (element.hasAttribute('style') && element.style) {
    const width = parseInt(element.style.width, 10);
    if (!isNaN(width)) {
      const height = parseInt(element.style.height, 10);
      if (!isNaN(height)) {
        return {width: width, height: height};
      }
    }
  }
}

// Filters certain anchors from document content
// This is a largely a hack for a particular feed I subscribe to that uses
// something along the lines of placeholder urls in the content, but because
// script is not evaluated elsewhere the bad urls all stay and this causes
// issues elsewhere and broken links.
// TODO: maybe just generalize this to unwrap all anchors that contain
// invalid urls
// TODO: shouldn't this be an unwrap? what if the anchor has valuable content?
export function filter_invalid_anchors(document) {
  if (document.body) {
    const anchors = document.body.querySelectorAll('a');
    for (const anchor of anchors) {
      if (anchor_is_invalid(anchor)) {
        anchor.remove();
      }
    }
  }
}

// Returns true if the anchor has an invalid href
// TODO: inline
function anchor_is_invalid(anchor) {
  const hrefValue = anchor.getAttribute('href');
  return hrefValue && /^\s*https?:\/\/#/i.test(hrefValue);
}

// Filters width and height of large images to avoid skewing in view
// An image is large if it is more than 1000px in width or height
// This allows retaining of width and height in other images, which avoids the
// issue of removing width and height from small images that have very large
// natural width or height. This is typical of icon or svg images that are very
// large when missing dimensions.
export function filter_large_image_attributes(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (image_is_large(image)) {
        image.removeAttribute('width');
        image.removeAttribute('height');
      }
    }
  }
}

function image_is_large(image) {
  const width_string = image.getAttribute('width');
  if (!width_string) {
    return false;
  }

  const height_string = image.getAttribute('height');
  if (!height_string) {
    return false;
  }

  const width_int = parseInt(width_string, 10);
  if (isNaN(width_int)) {
    return false;
  } else if (width_int > 1000) {
    return true;
  }

  const height_int = parseInt(height_string, 10);
  if (isNaN(height_int)) {
    return false;
  } else if (height_int > 1000) {
    return true;
  }

  return false;
}

const lazy_image_attribute_names = [
  'load-src', 'data-src', 'data-src-full16x9', 'data-src-large',
  'data-original-desktop', 'data-baseurl', 'data-flickity-lazyload',
  'data-lazy', 'data-path', 'data-image-src', 'data-original',
  'data-adaptive-image', 'data-imgsrc', 'data-default-src', 'data-hi-res-src'
];

// Transforms lazily-loaded images found in document content
// TODO: try and determine if an image with a src attribute is using a
// placeholder image in the src attribute and a full image from another
// attribute
export function filter_lazy_images(document) {
  // Look for images that are missing a src attribute, and have an alternate
  // attribute that contains a url that could serve as the image's new src,
  // and then set the src

  if (document.body) {
    const images = document.body.getElementsByTagName('img');
    for (const image of images) {
      if (!image_has_source(image)) {
        const attr_names = image.getAttributeNames();
        for (const attr_name of lazy_image_attribute_names) {
          if (attr_names.includes(attr_name)) {
            const lazy_attr_value = image.getAttribute(attr_name);
            if (url_string_is_valid(lazy_attr_value)) {
              image.removeAttribute(attr_name);
              image.setAttribute('src', lazy_attr_value);
              break;
            }
          }
        }
      }
    }
  }
}

// Filters empty leaf-like nodes from document content
export function filter_leaf_nodes(document) {
  if (document.body) {
    const root = document.documentElement;
    const elements = document.body.querySelectorAll('*');
    for (const element of elements) {
      if (root.contains(element) && node_is_leaf(element)) {
        element.remove();
      }
    }
  }
}

// Recursive
function node_is_leaf(node) {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE: {
      if (element_is_leaf_exception(node)) {
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


const leaf_exception_element_names = [
  'area', 'audio',  'base', 'col',      'command', 'br',    'canvas', 'col',
  'hr',   'iframe', 'img',  'input',    'keygen',  'meta',  'nobr',   'param',
  'path', 'source', 'sbg',  'textarea', 'track',   'video', 'wbr'
];

// TODO: re-use void elements list? maybe something like a two part condition
// that returns true if node is void element or is in extras list. Actually
// that doesn't seem quite right. I've confused myself here with this comment.
export function element_is_leaf_exception(element) {
  return leaf_exception_element_names.includes(element.localName);
}

// Filters certain list elements from document content
// TODO: restrict children of list to proper child type. E.g. only allow li or
// form within ul/ol, and dd/dt/form within dl. Do some type of transform like
// move such items to within a new child
export function filter_list_elements(document) {
  if (!document.body) {
    return;
  }

  const ancestor = document.body;
  const lists = ancestor.querySelectorAll('ul, ol, dl');

  // TODO: maybe this empty checking should be moved into the node_is_leaf
  // logic as a special case for list elements. That way it will be recursive.
  // But this does a moving of children where as the leaf code just removes. So
  // that would also entail changing the meaning of leaf filtering from filter
  // to transform.
  for (const list of lists) {
    if (list_element_is_empty(list)) {
      list_element_remove(list);
    }
  }

  for (const list of lists) {
    list_element_unwrap_single_item(list);
  }
}

// Return true if list is 'empty'
function list_element_is_empty(list) {
  // Return true if the list has no child nodes. This is redundant with leaf
  // filtering but I think it is ok and prefer to not make assumptions about
  // composition with other filters
  if (!list.firstChild) {
    return true;
  }

  const item = list.firstElementChild;

  // If the list has no elements, only nodes, then return true.
  if (!item) {
    return true;
  }

  // TODO: this check is too simple, because it ignores tolerable intermediate
  // elements, such as <ul><form><li/><li/></form></ul>. That is not empty. And
  // I believe it is still well-formed.

  // If this is the only element in the list, then check if it is empty.
  // NOTE: the first child check is admittedly simplistic and easily defeated
  // even just by a whitespace text node. But the goal I think is not to be
  // perfect and just grab low hanging fruit.
  if (!item.nextElementSibling && !item.firstChild) {
    return true;
  }

  // The list is not empty
  return false;
}

function list_element_remove(list) {
  const document = list.ownerDocument;

  // Add leading padding
  if (list.previousSibling &&
      list.previousSibling.nodeType === Node.TEXT_NODE) {
    list.parentNode.insertBefore(document.createTextNode(' '), list);
  }

  const first_child = list.firstChild;

  // Move any child nodes (there may be none). As each first child is moved,
  // the next child becomes the first child.
  for (let node = first_child; node; node = list.firstChild) {
    list.parentNode.insertBefore(node, list);
  }

  // Add trailing padding if needed. Also check if there were children, so as
  // to not add padding on top of the leading padding when there is no need.
  if (first_child && list.nextSibling &&
      list.nextSibling.nodeType === Node.TEXT_NODE) {
    list.parentNode.insertBefore(document.createTextNode(' '), list);
  }

  list.remove();
}

// Unwraps single item or empty list elements
function list_element_unwrap_single_item(list) {
  const list_parent = list.parentNode;
  if (!list_parent) {
    return;
  }

  const document = list.ownerDocument;
  const item = list.firstElementChild;

  // If the list has no child elements then just remove. This is overly simple
  // and could lead to data loss, but it is based on the assumption that empty
  // lists are properly handled in the first place earlier. Basically, this
  // should never happen and should almost be an assert?
  if (!item) {
    list.remove();
    return;
  }

  // If the list has more than one child element then leave the list as is
  if (item.nextElementSibling) {
    return;
  }

  // If the list's only child element isn't one of the correct types, ignore it
  // TODO: use array and .includes
  const list_item_names = {li: 0, dt: 0, dd: 0};
  if (!(item.localName in list_item_names)) {
    return;
  }

  // If the list has one child element of the correct type, and that child
  // element has no inner content, then remove the list. This will also remove
  // any non-element nodes within the list outside of the child element.
  if (!item.firstChild) {
    // If removing the list, avoid the possible merging of adjacent text nodes
    if (list.previousSibling &&
        list.previousSibling.nodeType === Node.TEXT_NODE && list.nextSibling &&
        list.nextSibling.nodeType === Node.TEXT_NODE) {
      list_parent.replaceChild(document.createTextNode(' '), list);

    } else {
      list.remove();
    }

    return;
  }

  // The list has one child element with one or more child nodes. Move the
  // child nodes to before the list and then remove iterator.

  // Add leading padding
  if (list.previousSibling &&
      list.previousSibling.nodeType === Node.TEXT_NODE && item.firstChild &&
      item.firstChild.nodeType === Node.TEXT_NODE) {
    list_parent.insertBefore(document.createTextNode(' '), list);
  }

  // Move the children of the item to before the list, maintainin order
  for (let node = item.firstChild; node; node = item.firstChild) {
    list_parent.insertBefore(node, list);
  }

  // Add trailing padding
  if (list.nextSibling && list.nextSibling.nodeType === Node.TEXT_NODE &&
      list.previousSibling &&
      list.previousSibling.nodeType === Node.TEXT_NODE) {
    list_parent.insertBefore(document.createTextNode(' '), list);
  }

  list.remove();
}


// Filters certain whitespace from a document. This scans the text nodes of a
// document and modifies certain text nodes.
export function filter_node_whitespace(document) {
  if (!document.body) {
    return;
  }

  // Ignore node values shorter than this length
  const node_value_length_min = 3;

  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    if (value.length > node_value_length_min && !node_is_ws_sensitive(node)) {
      const new_value = string_condense_whitespace(value);
      if (new_value.length !== value.length) {
        node.nodeValue = new_value;
      }
    }
  }
}

// TODO: inline
function node_is_ws_sensitive(node) {
  return node.parentNode.closest(
      'code, pre, ruby, script, style, textarea, xmp');
}


// Specifies that all links are noreferrer
// TODO: this function's behavior conflicts with attribute filter. Need to
// whitelist this attribute (and this value) for this element.
export function add_noreferrer_to_anchors(document) {
  if (document.body) {
    const anchors = document.body.getElementsByTagName('a');
    for (const anchor of anchors) {
      anchor.setAttribute('rel', 'noreferrer');
    }
  }
}

// Transforms noscript elements
export function filter_noscript_elements(document) {
  if (document.body) {
    const noscripts = document.body.querySelectorAll('noscript');
    for (const noscript of noscripts) {
      element_unwrap(noscript);
    }
  }
}

// Removes ping attributes from anchor elements in document content
export function remove_ping_attribute_from_all_anchors(document) {
  if (document.body) {
    const anchors = document.body.querySelectorAll('a[ping]');
    for (const anchor of anchors) {
      anchor.removeAttribute('ping');
    }
  }
}


// Transforms responsive images in document content. An image is 'responsive' if
// it uses a srcset instead of a src, such that the actual image used is derived
// dynamically after the document has been loaded. This filter looks for such
// images and changes them to use one of the descriptors from the srcset as the
// src.
export function filter_responsive_images(document) {
  if (document.body) {
    const images = document.body.getElementsByTagName('img');
    for (const image of images) {
      if (!image.hasAttribute('src') && image.hasAttribute('srcset')) {
        const descriptor = image_find_best_srcset_descriptor(image);
        if (descriptor) {
          image_transform_to_descriptor(image, descriptor);
        }
      }
    }
  }
}

// Selects the best srcset to use from an image's srcset attribute value.
// Returns the parsed descriptor object. Returns undefined if no descriptor
// found
function image_find_best_srcset_descriptor(image) {
  const srcset_attr_value = image.getAttribute('srcset');
  if (!srcset_attr_value) {
    return;
  }

  const descriptors = parse_srcset_wrapper(srcset_attr_value);

  // For the time being, the preference is whatever is first, no special
  // handling of descriptor.d, and only one dimension needed
  for (const desc of descriptors) {
    if (desc.url && (desc.w || desc.h)) {
      return desc;
    }
  }

  // If we did not find a descriptor above, search again but relax the
  // dimensions requirement
  for (const desc of descriptors) {
    if (desc.url) {
      return desc;
    }
  }
}

// Changes the src, width, and height of an image to the properties of the
// given descriptor, and removes the srcset attribute.
function image_transform_to_descriptor(image, descriptor) {
  image.setAttribute('src', descriptor.url);

  // The srcset is no longer in use
  image.removeAttribute('srcset');

  // Also change the width and height attributes. This avoids scaling issues

  if (descriptor.w) {
    image.setAttribute('width', '' + descriptor.w);
  } else {
    image.removeAttribute('width');
  }

  if (descriptor.h) {
    image.setAttribute('height', '' + descriptor.h);
  } else {
    image.removeAttribute('height');
  }
}


// Unwraps anchor elements containing href attribute values that are javascript
export function filter_script_anchors(document) {
  if (document.body) {
    const anchors = document.body.querySelectorAll('a[href]');
    for (const anchor of anchors) {
      if (url_string_has_script_protocol(anchor.getAttribute('href'))) {
        element_unwrap(anchor);
      }
    }
  }
}

// TODO: inline
// Returns true if the url has the 'javascript:' protocol. Does not throw in
// the case of bad input. Tolerates leading whitespace.
function url_string_has_script_protocol(url_string) {
  // For a url string to have the script protocol it must be longer than this
  const JS_PREFIX_LEN = 'javascript:'.length;
  // The type check is done to allow for bad inputs for caller convenience. The
  // length check is an attempt to reduce the number of regex calls.
  return typeof url_string === 'string' && url_string.length > JS_PREFIX_LEN &&
      /^\s*javascript:/i.test(url_string);
}


// Removes script elements from document content
export function filter_script_elements(document) {
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    script.remove();
  }
}

export function filter_small_images(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (image_is_small(image)) {
        image_remove(image);
      }
    }
  }
}

// TODO: merge this with image_is_large, make a function that does something
// like image_bin_size, and returns small or large or other. Then deprecate
// image_is_small and image_is_large
// TODO: furthermore, consider merging filter_small_images and
// filter_large_image into a single filter filter_image_by_size
function image_is_small(image) {
  const width_string = image.getAttribute('width');
  if (!width_string) {
    return false;
  }

  const height_string = image.getAttribute('height');
  if (!height_string) {
    return false;
  }

  const width_int = parseInt(width_string, 10);
  if (isNaN(width_int)) {
    return false;
  }

  const height_int = parseInt(height_string, 10);
  if (isNaN(height_int)) {
    return false;
  }

  if (width_int < 3) {
    return false;
  }

  if (height_int < 3) {
    return false;
  }

  if (width_int < 33 && height_int < 33) {
    return true;
  }

  return false;
}


// Filter semantic web elements from document content
export function filter_semantic_elements(document) {
  if (document.body) {
    const selector = 'article, aside, footer, header, main, section';
    const elements = document.body.querySelectorAll(selector);
    for (const element of elements) {
      element_unwrap(element);
    }
  }
}

// Removes images without src attribute
export function filter_sourceless_images(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (!image_has_source(image)) {
        image_remove(image);
      }
    }
  }
}

// Remove whitespace and whitespace-like content from the start and end of a
// document's body.
export function document_trim(document) {
  if (document.body) {
    const first_child = document.body.firstChild;
    if (first_child) {
      trim_document_step(first_child, 'nextSibling');
      const last_child = document.body.lastChild;
      if (last_child && last_child !== first_child) {
        trim_document_step(last_child, 'previousSibling');
      }
    }
  }
}

function trim_document_step(start_node, edge_name) {
  let node = start_node;
  while (node && node_is_trimmable(node)) {
    const sibling = node[edge_name];
    node.remove();
    node = sibling;
  }
}

function node_is_trimmable(node) {
  return node.nodeType === Node.TEXT_NODE ?
      !node.nodeValue.trim() :
      ['br', 'hr', 'nobr'].includes(node.localName);
}

// Filters certain table elements from document content
export function filter_table_elements(document, table_row_scan_max) {
  if (document.body) {
    const elements = document.body.querySelectorAll(
        'colgroup, hgroup, multicol, tbody, tfoot, thead');
    for (const element of elements) {
      element_unwrap(element);
    }

    const tables = document.body.querySelectorAll('table');
    for (const table of tables) {
      if (table_element_is_single_column(table, table_row_scan_max)) {
        table_element_unwrap(table);
      }
    }
  }
}

function table_element_is_single_column(table, table_row_scan_max) {
  const rows = table.rows;
  const safe_limit = Math.min(rows.length, table_row_scan_max);
  for (let i = 0; i < safe_limit; i++) {
    if (!row_is_single_column(rows[i])) {
      return false;
    }
  }
  return true;
}

function row_is_single_column(row) {
  const cells = row.cells;
  let filled_cell_count = 0;

  // TODO: review the logic here. Is pre-dec op correct?

  for (let i = 0, len = cells.length; i < len; i++) {
    if (!node_is_leaf(cells[i]) && ++filled_cell_count > 1) {
      return false;
    }
  }

  return true;
}

function table_element_unwrap(table) {
  const rows = table.rows;
  const row_count = rows.length;
  const parent = table.parentNode;
  const document = table.ownerDocument;

  parent.insertBefore(document.createTextNode(' '), table);

  for (let i = 0; i < row_count; i++) {
    const row = rows[i];
    for (let j = 0, clen = row.cells.length; j < clen; j++) {
      const cell = row.cells[j];

      // Move the children of the cell to before the table
      for (let node = cell.firstChild; node; node = cell.firstChild) {
        parent.insertBefore(node, table);
      }
    }

    parent.insertBefore(document.createElement('p'), table);
  }

  parent.insertBefore(document.createTextNode(' '), table);
  table.remove();
}

const telemetry_host_patterns = [
  /\/\/.*2o7\.net\//i,
  /\/\/ad\.doubleclick\.net\//i,
  /\/\/ad\.linksynergy\.com\//i,
  /\/\/analytics\.twitter\.com\//i,
  /\/\/anon-stats\.eff\.org\//i,
  /\/\/bat\.bing\.com\//i,
  /\/\/b\.scorecardresearch\.com\//i,
  /\/\/beacon\.gu-web\.net\//i,
  /\/\/.*cloudfront\.net\//,
  /\/\/googleads\.g\.doubleclick\.net\//i,
  /\/\/in\.getclicky\.com\//i,
  /\/\/insight\.adsrvr\.org\//i,
  /\/\/me\.effectivemeasure\.net\//i,
  /\/\/metrics\.foxnews\.com\//i,
  /\/\/.*moatads\.com\//i,
  /\/\/pagead2\.googlesyndication\.com\//i,
  /\/\/pixel\.quantserve\.com\//i,
  /\/\/pixel\.wp\.com\//i,
  /\/\/pubads\.g\.doubleclick\.net\//i,
  /\/\/sb\.scorecardresearch\.com\//i,
  /\/\/stats\.bbc\.co\.uk\//i,
  /\/\/statse\.webtrendslive\.com\//i,
  /\/\/pixel\.wp\.com\//i,
  /\/\/t\.co\//i,
  /\/\/www\.facebook\.com\/tr/i
];

// Removes some telemetry data from a document.
// @param document {Document}
// @param document_url {URL} canonical document url
export function filter_telemetry_elements(document, document_url) {
  assert(document_url instanceof URL);

  // Analysis is limited to descendants of body
  if (!document.body) {
    return;
  }


  // Telemetry images are usually hidden, so treat visibility as an indicator.
  // False positives are probably not too harmful. Removing images based on
  // visibility overlaps with sanitization, but this is intentionally naive
  // regarding what other filters are applied to the document.
  const images = document.body.querySelectorAll('img');
  for (const image of images) {
    if (element_is_hidden_inline(image) || image_is_pixel(image) ||
        image_has_telemetry_source(image, document_url)) {
      image_remove(image);
    }
  }
}

// Returns true if an image is a pixel-sized image
function image_is_pixel(image) {
  return image.hasAttribute('src') && image.hasAttribute('width') &&
      image.width < 2 && image.hasAttribute('height') && image.height < 2;
}

// This test only considers the src attribute. Using srcset or picture source
// is exceedingly rare mechanism for telemetry so ignore those channels.
// @param image {Image}
// @param document_url {URL}
function image_has_telemetry_source(image, document_url) {
  if (!image.hasAttribute('src')) {
    return false;
  }

  const src = image.getAttribute('src').trim();
  if (!src) {
    return false;
  }

  // TODO: all these attempts to avoid parsing are probably silly when it
  // isn't even clear that this is slow. Just parse the url. It is simpler. This
  // was premature optimization

  // Prior to parsing the url, try and exclude some of the url strings to avoid
  // the parsing cost.

  // Very short urls are probably not telemetry
  const MIN_IMAGE_URL_LENGTH = 's.gif'.length;
  if (src.length < MIN_IMAGE_URL_LENGTH) {
    return false;
  }

  // Ignore urls that appear invalid. Invalid urls are not a telemetry concern
  // because requests will presumably fail.
  if (src.includes(' ')) {
    return false;
  }

  // For protocol-relative urls, allow them and continue.
  // TODO: but that just fails in the URL parser ....? Need to revisit this.
  // Basically I want to be able to match and reject protocol relative urls.
  // But I want to work with a URL object. Perhaps I should substitute in http
  // automatically? Or require base url here when constructing the url?

  // Relative urls are generally not telemetry urls.
  // Urls using the 'data:' protocol are generally not telemetry
  // urls because no networking is involved. Basically only look at http and
  // https
  // TODO: make non-capturing regex
  const URL_START_PATTERN = /^(http:\/\/|https:\/\/|\/\/)/i;
  if (!URL_START_PATTERN.test(src)) {
    return false;
  }

  let imageURL;
  try {
    imageURL = new URL(src);
  } catch (error) {
    // It is a relative url, or an invalid url of some kind. It is probably not
    // telemetry, or at least, not a telemetry concern.
    return false;
  }

  // Ignore 'internal' urls.
  if (!url_is_external(document_url, imageURL)) {
    return false;
  }

  for (const pattern of telemetry_host_patterns) {
    if (pattern.test(src)) {
      return true;
    }
  }

  return false;
}
