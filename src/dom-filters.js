import {assert, AssertionError} from '/src/assert.js';
import * as boilerplate from '/src/boilerplate.js';
import * as color from '/src/color.js';
import * as dom_utils from '/src/dom-utils.js';
import * as net from '/src/net.js';
import * as utils from '/src/utils.js';

// Applies most of the filters in the proper order to the document
export async function composite_document_filter(document, options = {}) {
  assert(document instanceof Document);
  assert(typeof options === 'object');

  frame_filter(document);
  body_filter(document);
  iframe_filter(document);
  comment_filter(document);
  visibility_filter(document, options.contrast_matte, options.contrast_ratio);
  const blacklist_general = [
    'applet', 'audio',  'basefont', 'bgsound', 'command',  'datalist',
    'dialog', 'embed',  'isindex',  'link',    'math',     'meta',
    'object', 'output', 'param',    'path',    'progress', 'spacer',
    'style',  'svg',    'title',    'video',   'xmp'
  ];
  blacklist_filter(document, blacklist_general);
  script_filter(document);
  image_lazy_filter(document);
  url_resolve_filter(document);
  image_responsive_filter(document);
  lonestar_filter(document);
  image_dead_filter(document);
  await image_size_filter(
      document, options.image_size_timeout, options.is_allowed_request);
  boilerplate_filter(document);
  anchor_script_filter(document);
  // TODO: compose these two filters
  image_size_small_filter(document);
  image_size_large_filter(document);
  condense_tagnames_filter(document, false);
  head_filter(document);
  base_filter(document);
  anchor_validity_filter(document);
  anchor_format_filter(document);
  form_filter(document);
  breakrule_filter(document);
  horizontal_rule_filter(document);
  format_filter(document);
  nest_filter(document);
  semantic_filter(document);
  figure_filter(document);
  container_filter(document);
  list_filter(document);
  table_filter(document, options.table_scan_max_rows);
  emphasis_filter(document, options.emphasis_max_length);
  node_whitespace_filter(document);
  node_leaf_filter(document);
  document_trim_filter(document);
  const attribute_whitelist = {
    a: ['href', 'name', 'title', 'rel'],
    iframe: ['src'],
    source: ['media', 'sizes', 'srcset', 'src', 'type'],
    img: ['src', 'alt', 'title', 'srcset', 'width', 'height']
  };
  attribute_unknown_filter(document, attribute_whitelist);
  attribute_empty_filter(document);
}

export function anchor_format_filter(document) {
  const anchors = document.querySelectorAll('a');
  for (const anchor of anchors) {
    if (!anchor.hasAttribute('href')) {
      dom_utils.unwrap_element(anchor);
    }
  }
}

// TODO: write a test that explicitly checks matching of browser behavior
export function anchor_script_filter(document) {
  const threshold = 'javascript:'.length;
  const pattern = /^\s*javascript:/i;
  const anchors = document.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (href && href.length > threshold && pattern.test(href)) {
      dom_utils.unwrap_element(anchor);
    }
  }
}

export function anchor_validity_filter(document) {
  const pattern = /^\s*https?:\/\/#/i;
  const anchors = document.querySelectorAll('a');
  for (const anchor of anchors) {
    const href_value = anchor.getAttribute('href');
    if (href_value && pattern.test(href_value)) {
      anchor.remove();
    }
  }
}

// TODO: consider aggregating with other attribute filters
export function attribute_empty_filter(document) {
  for (const element of document.querySelectorAll('*')) {
    for (const name of element.getAttributeNames()) {
      if (!dom_utils.is_boolean(element, name)) {
        const value = element.getAttribute(name);
        if (!value || !value.trim()) {
          element.removeAttribute(name);
        }
      }
    }
  }
}

// Removes certain attributes from all elements in a document. |whitelist| is
// an object map where each key is element name and each value is array of
// names of retainable attributes.
export function attribute_unknown_filter(document, whitelist) {
  assert(typeof whitelist === 'object');
  const elements = document.getElementsByTagName('*');
  for (const element of elements) {
    const names = element.getAttributeNames();
    if (names.length) {
      const good_names = whitelist[element.localName] || [];
      for (const name of names) {
        if (!good_names.includes(name)) {
          element.removeAttribute(name);
        }
      }
    }
  }
}

export function base_filter(document) {
  for (const base of document.querySelectorAll('base')) {
    base.remove();
  }
}

// |blacklist| is an array of element names.
export function blacklist_filter(document, blacklist) {
  assert(Array.isArray(blacklist));
  if (blacklist.length < 1) {
    return;
  }

  // The contains check is a questionable optimization that tries to avoid doing
  // dom work on detached subtrees
  const elements = document.querySelectorAll(blacklist.join(','));
  for (const element of elements) {
    if (document.documentElement.contains(element)) {
      element.remove();
    }
  }
}

// Ensures that a document has a body element
// TODO: this should not assume the frame filter ran, right now this does not
// create body when encountering frameset which is misleading, filters should
// be designed so as to be maximally independent and not rely on filter call
// order (not assume some other filters ran before)
// TODO: this needs a name that clarifies what it does, it is not obvious
export function body_filter(document) {
  if (!document.body) {
    const message = 'This document has no content';
    const error_node = document.createTextNode(message);
    const body_element = document.createElement('body');
    body_element.appendChild(error_node);
    document.documentElement.appendChild(body_element);
  }
}

export function boilerplate_filter(document, options = {}) {
  let dataset = boilerplate.parse_blocks(document, boilerplate.neutral_score);
  assert(dataset);
  dataset = boilerplate.extract_features(dataset, options);
  assert(dataset);
  dataset = boilerplate.classify(dataset, boilerplate.score_block);
  assert(dataset);
  for (const row of dataset) {
    if (row.score < boilerplate.neutral_score) {
      const element = boilerplate.find_block_element(document, row);
      assert(element);
      element.remove();
    }
  }
}

export function breakrule_filter(document) {
  const subsequent_brs = document.querySelectorAll('br + br');
  for (const br of subsequent_brs) {
    br.remove();
  }
}

// Removes elements containing text that is not perceptible by calculating the
// approximate contrast between the foreground text color and the background
// color.
// @param matte {color} the base background color for alpha blending, optional,
// defaults to white
// @param min_contrast {Number} the minimum contrast ratio, below which elements
// are deemed not visible, optional, defaults to a conservative 1.2
export function color_contrast_filter(document, matte, min_contrast) {
  const body = document.body;
  if (!body) {
    return;
  }

  const DEFAULT_MATTE = color.WHITE;
  if (typeof matte === 'undefined') {
    matte = DEFAULT_MATTE;
  }

  const DEFAULT_MIN_CONTRAST = 1.2;
  if (typeof min_contrast === 'undefined') {
    min_contrast = DEFAULT_MIN_CONTRAST;
  }

  const it = document.createNodeIterator(body, NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  while (node) {
    const element = node.parentNode;
    const fore = dom_utils.element_derive_text_color(element);
    const back = dom_utils.element_derive_bgcolor(element, matte);
    const contrast = color.get_contrast(fore, back);
    if (contrast < min_contrast) {
      node.remove();
    }
    node = it.nextNode();
  }
}

// Removes all HTML comment nodes from the document
export function comment_filter(document) {
  const it = document.createNodeIterator(
      document.documentElement, NodeFilter.SHOW_COMMENT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

// Replaces certain elements in |document| with equivalents that use fewer
// characters in the element name, so that when a document it serialized, it
// contains fewer characters. |copy_attrs_flag| is optional boolean specifying
// whether to copy html attributes when replacing an element.
export function condense_tagnames_filter(document, copy_attrs_flag) {
  const renames = [
    {before: 'strong', after: 'b'}, {before: 'em', after: 'i'},
    {before: 'layer', after: 'div'}
  ];
  for (const rename of renames) {
    const elements = document.querySelectorAll(rename.before);
    for (const element of elements) {
      dom_utils.coerce_element(element, rename.after, copy_attrs_flag);
    }
  }
}

// Removes container-like elements from the document
export function container_filter(document) {
  const elements = document.querySelectorAll('div, ilayer, layer');
  for (const element of elements) {
    dom_utils.unwrap_element(element);
  }
}

// Explores document content searching for segments of emphasized text, such as
// bold, italicized, or underlined text. If a segment is found that is longer
// than the specified threshold, then the segment is de-emphasized (the emphasis
// element is removed but its descendant nodes remain).
//
// Currently, this ignores CSS rules due to the cost of computing styles. A
// future implementation may consider computed style.
//
// A substantial amount of content on the Internet is written poorly. Many
// authors get carried away with underlining everything. Sometimes emphasis is
// used for other purposes than conventional use, such as simple visual style.
//
// @param document {Document} the document to analyze
// @param max_length_threshold {Number} an optional integer representing a
// threshold of text length above which a segment of emphasized text is
// considered too long. Note that when calculating the length of some emphasized
// text for comparison against this threshold, only the non-whitespace length is
// used.
// @error {Error} if document is not a Document
// @error {Error} if the text length parameter is not a positive integer
export function emphasis_filter(document, max_length_threshold = 0) {
  assert(Number.isInteger(max_length_threshold) && max_length_threshold >= 0);

  // 0 means indefinite emphasis is allowed, which means no filtering should
  // occur at all. Technically this function should not have been called because
  // it was pointless but this should not cause an error.
  if (max_length_threshold === 0) {
    return;
  }

  const selector = 'b, big, em, i, strong, mark, u';
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    const no_ws = element.textContent.replace(/\s+/, '');
    if (no_ws.length > max_length_threshold) {
      dom_utils.unwrap_element(element);
    }
  }
}

export function figure_filter(document) {
  for (const figure of document.querySelectorAll('figure')) {
    const child_count = figure.childElementCount;
    if (child_count === 1) {
      if (figure.firstElementChild.localName === 'figcaption') {
        // caption without an image, remove it all
        figure.remove();
      } else {
        dom_utils.unwrap_element(figure);
      }
    } else if (child_count === 0) {
      dom_utils.unwrap_element(figure);
    }
  }
}

// Removes or changes form-related elements from the document
// TODO: remove reliance on body, just search everywhere
export function form_filter(document) {
  const body = document.body;
  if (!body) {
    return;
  }

  const forms = body.querySelectorAll('form');
  for (const form of forms) {
    dom_utils.unwrap_element(form);
  }

  const labels = body.querySelectorAll('label');
  for (const label of labels) {
    dom_utils.unwrap_element(label);
  }

  // TODO: I should also consider removing label-like elements that an author
  // did not use a label for. I think there are several instances of where an
  // author does something like use a span, or a neighboring table cell. This
  // might be too difficult to pull off, or require so much processing that it
  // is not worth it.
  // While the selector string is invariant to function calls I prefer to define
  // it here, near where it is used, instead of defining it at module scope.
  // This is similar to the style of declaring variables within loop bodies. I
  // assume that if it is a performance issue the js engine is smart enough to
  // hoist.
  const selector =
      'button, fieldset, input, optgroup, option, select, textarea';
  const form_related_elements = body.querySelectorAll(selector);
  // The contains check avoids removing already-removed elements. It is worth
  // the cost to avoid the more expensive removal operations.
  for (const element of form_related_elements) {
    if (body.contains(element)) {
      element.remove();
    }
  }
}

export function format_filter(document) {
  const selector = [
    'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
    'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink', 'font',
    'plaintext', 'small', 'tt'
  ].join(',');

  if (document.body) {
    const elements = document.body.querySelectorAll(selector);
    for (const element of elements) {
      dom_utils.unwrap_element(element);
    }
  }
}

// Removes frame-related content from a document, including noframes, but
// not iframes.
// TODO: the default message text for empty body should be a param
export function frame_filter(document) {
  // A legal document should only have 1 frameset element. If it has more than
  // one, we ignore the rest after the first. If there is no frameset element
  // in the document, ensure no other frame-related elements remain, and exit.
  // We are intentionally not using the document.body shortcut because of the
  // extra complexity with xml documents and how frameset matches the shortcut.
  const frameset_element = document.querySelector('frameset');
  if (!frameset_element) {
    // Ensure no frame elements located outside of frameset remain in malformed
    // html
    const frame_elements = document.querySelectorAll('frame');
    for (const frame_element of frame_elements) {
      frame_element.remove();
    }

    // Ensure no noframes elements located outside of frameset remain in
    // malformed html
    const noframes_elements = document.querySelectorAll('noframes');
    for (const noframes_element of noframes_elements) {
      noframes_element.remove();
    }

    return;
  }

  // NOTE: the following transformations are not optimized for live document
  // modification. In other words, assume the document is inert.

  // If there is a frameset, first look for an existing body element. Do not
  // use the document.body shortcut because it will match frameset. This is
  // trying to handle the malformed html case. If there is a body, clear it out
  // so that it is setup for reuse. If there is no body, create one in replace
  // of the original frameset.

  let body_element = document.querySelectorAll('body');
  if (body_element) {
    frameset_element.remove();

    // If a body element existed in addition to the frameset element, clear it
    // out. This is malformed html.
    let child = body_element.firstChild;
    while (child) {
      body_element.removeChild(child);
      child = body_element.firstChild;
    }
  } else {
    // Removing the frameset will leave the document without a body. Since we
    // have a frameset and no body, create a new body element in place of the
    // frameset. This will detach the existing frameset. Again this assumes
    // there is only one frameset.
    body_element = document.createElement('body');
    // Confusing parameter order note: replaceChild(new child, old child)
    document.documentElement.replaceChild(body_element, frameset_element);
  }

  // Now look for noframes elements within the detached frameset, and if found,
  // move their contents into the body element. I am not sure if there should
  // only be one noframes element or multiple are allowed, so just look for all.
  const noframes_elements = frameset_element.querySelectorAll('noframes');
  for (const e of noframes_elements) {
    for (let node = e.firstChild; node; node = e.firstChild) {
      body_element.appendChild(node);
    }
  }

  // Ensure nothing frame related remains, as a minimal filter guarantee, given
  // the possibility of malformed html
  const elements = document.querySelectorAll('frame, frameset, noframes');
  for (const element of elements) {
    element.remove();
  }

  // Avoid producing an empty body without an explanation
  if (!body_element.firstChild) {
    const message = 'Unable to display document because it uses HTML frames';
    const node = document.createTextNode(message);
    body_element.appendChild(node);
  }
}

// Filters certain horizontal rule elements from document content
// Look for all <hr><hr> sequences and remove the second one. Naive in that it
// does not fully account for new document state as hrs removed.
export function horizontal_rule_filter(document) {
  if (document.body) {
    const hrs = document.body.querySelectorAll('hr + hr');
    for (const hr of hrs) {
      hr.remove();
    }
  }
}

export function head_filter(document) {
  // TODO: clarify whether a document can have multiple head elements by
  // locating and citing the spec
  const head_elements = document.querySelectorAll('head');
  for (const head_element of head_elements) {
    head_element.remove();
  }
}

// Removes iframe elements
export function iframe_filter(document) {
  if (document.body) {
    const frames = document.body.querySelectorAll('iframe');
    for (const frame of frames) {
      frame.remove();
    }
  }
}

// Removes dead images from the document. An image is 'dead' if it is
// unfetchable. One reason that an image is unfetchable is when an image does
// not have an associated source. Note this does not actually test if the image
// is fetchable, this only examines whether the image looks unfetchable based
// on its html.
//
// A future implementation might consider fetching. But there are some problems
// with that at the moment considering the overlap between this filter and the
// filter that sets the width and height of images when the dimensions are
// missing, and lack of clarity regarding browser caching of image requests,
// and in particular, concurrent image requests.
export function image_dead_filter(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (!dom_utils.image_has_source(image)) {
        dom_utils.remove_image(image);
      }
    }
  }
}

// This should occur before canonicalizing urls, because it may set attributes
// that need to be canonicalized that previously did not exist, and would be
// missed by the url_resolve_filter filter. This was previously a bug.
export function image_lazy_filter(document) {
  const lazy_names = [
    'big-src', 'load-src', 'data-src', 'data-src-full16x9', 'data-src-large',
    'data-original-desktop', 'data-baseurl', 'data-flickity-lazyload',
    'data-lazy', 'data-path', 'data-image-src', 'data-original',
    'data-adaptive-image', 'data-imgsrc', 'data-default-src', 'data-hi-res-src'
  ];

  if (document.body) {
    const images = document.body.getElementsByTagName('img');
    for (const image of images) {
      if (!dom_utils.image_has_source(image)) {
        const attr_names = image.getAttributeNames();
        for (const attr_name of lazy_names) {
          if (attr_names.includes(attr_name)) {
            const lazy_attr_value = image.getAttribute(attr_name);
            if (is_valid_url_string(lazy_attr_value)) {
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

// Only minor validation for speed. Tolerates bad input. This isn't intended to
// be the most accurate classification. Instead, it is intended to easily find
// bad urls and rule them out as invalid, even though some slip through, and not
// unintentionally rule out good urls.
// @param value {Any} should be a string but this tolerates bad input
// @returns {Boolean}
// TODO: move to dom-utils.js
function is_valid_url_string(value) {
  // The upper bound on len is an estimate, kind of a safeguard, hopefully never
  // causes a problem
  return typeof value === 'string' && value.length > 1 &&
      value.length <= 3000 && !value.trim().includes(' ');
}

// Scans the document body for responsive images and conditionally replaces a
// responsive image element's relevant attributes with properties from one of
// its srcset descriptors. An image is responsive if it uses a srcset instead of
// a src.
export function image_responsive_filter(document) {
  const selector = 'img[srcset]:not([src])';
  const images = document.querySelectorAll(selector);
  for (const image of images) {
    // In the event of a parsing error, srcset_parse returns an empty array,
    // which effectively means we do nothing in this loop
    const descs = dom_utils.srcset_parse(image.getAttribute('srcset'));
    let chosen_desc = null;
    for (const desc of descs) {
      if (desc.url) {
        if (desc.w || desc.h) {
          chosen_desc = desc;
          break;
        } else if (!chosen_desc) {
          // Fallback to matching the first descriptor with a url, but continue
          // looping until we either find a better descriptor or reach the end
          chosen_desc = desc;
        }
      }
    }

    if (chosen_desc) {
      image.removeAttribute('srcset');
      image.removeAttribute('width');
      image.removeAttribute('height');

      image.setAttribute('src', chosen_desc.url);
      if (chosen_desc.w) {
        image.setAttribute('width', '' + chosen_desc.w);
      }
      if (chosen_desc.h) {
        image.setAttribute('height', '' + chosen_desc.h);
      }
    }
  }
}

// Tries to set width/height attributes for all images in document
export function image_size_filter(document, timeout, is_allowed_request) {
  assert(document.baseURI);

  async function proc_image(image) {
    if (image.hasAttribute('width') && image.hasAttribute('height')) {
      return;
    }

    let width = 0, height = 0;

    // Check inline css
    if (element.style && element.hasAttribute('style')) {
      width = parseInt(element.style.width, 10);
      height = parseInt(element.style.height, 10);
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        image.setAttribute('width', width);
        image.setAttribute('height', height);
        return;
      } else {
        width = height = 0;
      }
    }

    if (!image.src) {
      return;
    }

    let url;
    try {
      url = new URL(image.src);
    } catch (error) {
      return;
    }

    // Check characters in url
    const exts = ['jpg', 'gif', 'svg', 'jpg', 'bmp', 'png'];
    const pairs = [{w: 'w', h: 'h'}, {w: 'width', h: 'height'}];
    if (url.protocol !== 'data:' &&
        exts.includes(utils.url_get_extension(url))) {
      for (const pair of pairs) {
        width = parseInt(url.searchParams.get(pairs.w), 10);
        height = parseInt(url.searchParams.get(pairs.h), 10);
        if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
          image.setAttribute('width', width);
          image.setAttribute('height', height);
          return;
        }
      }
    }

    try {
      const fimg =
          await net.fetch_image_element(url, timeout, is_allowed_request);
      image.setAttribute('width', fimg.width);
      image.setAttribute('height', fimg.height);
    } catch (error) {
      if (error instanceof AssertionError) {
        throw error;
      }
    }
  }

  const images = document.querySelectorAll('img');
  return Promise.all(Array.prototype.map.call(images, proc_image));
}

export function image_size_large_filter(document) {
  const images = document.querySelectorAll('img');
  for (const image of images) {
    if (image_is_size_large(image)) {
      image.removeAttribute('width');
      image.removeAttribute('height');
    }
  }
}

function image_is_size_large(image) {
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

export function image_size_small_filter(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (image_is_small(image)) {
        dom_utils.remove_image(image);
      }
    }
  }
}

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


// Removes empty and/or single-item lists from the document
export function list_filter(document) {
  const lists = document.querySelectorAll('ul, ol, dl');

  for (const list of lists) {
    const parent = list.parentNode;
    if (!parent) {
      continue;
    }

    // Determine if the list is empty. If empty, process. Otherwise, continue
    // the loop to the next list.
    if (list.firstChild) {
      // The list has one or more child nodes. Inspect the list more closely
      // to determine emptiness.
      const firstElement = list.firstElementChild;
      if (firstElement) {
        // Of the list's child nodes, one or more are elements
        if (firstElement.nextElementSibling) {
          // The list has multiple child elements, it is not empty, so go to
          // the next list
          continue;
        } else {
          if (dom_utils.is_list_item(firstElement)) {
            // This is a list with just one element, so we want to unwrap
          } else {
            // Something like
            // <list><intermediate><item(s)/></intermediate</list>, we cannot be
            // certain, so do not filter and go to next list
            continue;
          }
        }
      } else {
        // We have a list with one or more child nodes, but none of them are
        // elements, so continue to unwrap
      }
    } else {
      // The list has no child nodes, so continue to unwrap
    }

    // If we reached here, we want to unwrap the list
    dom_utils.unwrap_element(list);
  }
}

// The lonestar filter is tasked with jamming radars. A guide to anti-telemetry
// can be found here: https://youtu.be/rGvblGCD7qM
export function lonestar_filter(document) {
  assert(document.baseURI);

  const host_patterns = [
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

  const document_url = new URL(document.baseURI);

  // Remove images that look like telemetry beacons
  const images = document.querySelectorAll('img');
  for (const image of images) {
    if (lonestar_is_telemetric(image, document_url, host_patterns, false)) {
      dom_utils.remove_image(image);
    }
  }

  // Specify all hyperlink anchors as noreferrer
  const anchors = document.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }

  // Remove ping attributes from anchors
  const anchors = document.querySelectorAll('a[ping]');
  for (const anchor of anchors) {
    anchor.removeAttribute('ping');
  }
}

function lonestar_is_telemetric(
    element, document_url, host_patterns, is_strict) {
  if (dom_utils.is_hidden_inline(element)) {
    return true;
  }

  // naturalWidth and naturalHeight are unavailable in inert documents
  // TODO: also match common names for pixel images like "pixel.gif", and
  // I think facebook uses "/p"
  if (element.localName === 'img' && element.hasAttribute('src') &&
      element.hasAttribute('width') && element.width < 2 &&
      element.hasAttribute('height') && element.height < 2) {
    return true;
  }

  if (element.localName === 'img' && element.hasAttribute('src')) {
    const src = element.getAttribute('src');
    let url;
    try {
      url = new URL(src, document_url);
    } catch (error) {
      // Ignore
    }

    if (url) {
      const local_protocols = ['data:', 'mailto:', 'tel:', 'javascript:'];
      if (!local_protocols.includes(url.protocol)) {
        if (is_strict) {
          if (document_url.origin !== url.origin) {
            return true;
          }
        } else {
          if (utils.url_get_upper_domain(document_url) !==
              utils.url_get_upper_domain(url)) {
            return true;
          }
        }
      }

      for (const pattern of host_patterns) {
        if (pattern.test(src)) {
          return true;
        }
      }
    }
  }

  return false;
}

// Searches the document for misnested elements and tries to fix each
// occurrence.
export function nest_filter(document) {
  if (!document.body) {
    return;
  }

  const nested_hr_elements =
      document.body.querySelectorAll('ul > hr, ol > hr, dl > hr');
  for (const hr of nested_hr_elements) {
    hr.remove();
  }

  const descendant_anchors_of_anchors = document.body.querySelectorAll('a a');
  for (const descendant_anchor of descendant_anchors_of_anchors) {
    dom_utils.unwrap_element(descendant_anchor);
  }

  const captions = document.body.querySelectorAll('figcaption');
  for (const caption of captions) {
    if (!caption.parentNode.closest('figure')) {
      caption.remove();
    }
  }

  const sources = document.body.querySelectorAll('source');
  for (const source of sources) {
    if (!source.parentNode.closest('audio, picture, video')) {
      source.remove();
    }
  }

  // display-block within display-block-inline
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

export function node_leaf_filter(document) {
  if (document.body) {
    const root = document.documentElement;
    const elements = document.body.querySelectorAll('*');
    for (const element of elements) {
      if (root.contains(element) && dom_utils.node_is_leaf(element)) {
        element.remove();
      }
    }
  }
}

// Filters certain whitespace from a document. This scans the text nodes of a
// document and modifies certain text nodes.
export function node_whitespace_filter(document) {
  if (!document.body) {
    return;
  }

  // TODO: inline
  function node_is_ws_sensitive(node) {
    return node.parentNode.closest(
        'code, pre, ruby, script, style, textarea, xmp');
  }

  // Ignore node values shorter than this length
  const node_value_length_min = 3;

  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    if (value.length > node_value_length_min && !node_is_ws_sensitive(node)) {
      const new_value = utils.condense_whitespace(value);
      if (new_value.length !== value.length) {
        node.nodeValue = new_value;
      }
    }
  }
}

export function script_filter(document) {
  // Remove noscripts
  // TODO: consider transform instead?
  if (document.body) {
    const noscripts = document.body.querySelectorAll('noscript');
    for (const noscript of noscripts) {
      noscript.remove();
    }
  }

  // Not restricted to body
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    script.remove();
  }
}

export function semantic_filter(document) {
  if (document.body) {
    const selector = 'article, aside, footer, header, main, section';
    const elements = document.body.querySelectorAll(selector);
    for (const element of elements) {
      dom_utils.unwrap_element(element);
    }
  }
}

// Filters certain table elements from document content
export function table_filter(document, row_scan_max) {
  const elements = document.querySelectorAll(
      'colgroup, hgroup, multicol, tbody, tfoot, thead');
  for (const element of elements) {
    dom_utils.unwrap_element(element);
  }

  const tables = document.querySelectorAll('table');
  for (const table of tables) {
    const rows = table.rows;
    const limit = Math.min(rows.length, row_scan_max);
    let is_single_column = true;
    for (let i = 0; i < limit && is_single_column; i++) {
      const cells = rows[i].cells;
      let filled = 0;
      for (let j = 0; j < cells.length; j++) {
        if (!dom_utils.node_is_leaf(cells[i])) {
          filled++;
          if (filled > 1) {
            is_single_column = false;
            break;
          }
        }
      }
    }

    if (is_single_column) {
      dom_utils.unwrap_element(table);
    }
  }
}

export function document_trim_filter(document) {
  if (document.body) {
    const first_child = document.body.firstChild;
    if (first_child) {
      trim_filter_step(first_child, 'nextSibling');
      const last_child = document.body.lastChild;
      if (last_child && last_child !== first_child) {
        trim_filter_step(last_child, 'previousSibling');
      }
    }
  }

  function trim_filter_step(start_node, edge_name) {
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
}

// Resolves all element attribute values that contain urls in |document|. Throws
// an error if the document has an invalid base URI.
export function url_resolve_filter(document) {
  // Intentionally propagate error if baseURI is invalid
  const base_url = new URL(document.baseURI);
  // Element name to attribute name map
  const map = {
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

  // In the first pass, select all mapped elements present anywhere in the
  // document, and resolve attribute values per element
  const selector = Object.keys(map).map(key => `${key}[${map[key]}]`).join(',');
  const elements = document.querySelectorAll(selector);

  for (const element of elements) {
    const attr_name = map[element.localName];
    if (attr_name) {
      const attr_value = element.getAttribute(attr_name);
      if (attr_value) {
        try {
          const url = new URL(attr_value, base_url);
          if (url.href !== attr_value) {
            element.setAttribute(attr_name, url.href);
          }
        } catch (error) {
          // Ignore
        }
      }
    }
  }

  // The remaining passes are body specific
  if (!document.body) {
    return;
  }

  const srcset_sel = 'img[srcset], source[srcset]';
  const srcset_els = document.body.querySelectorAll(srcset_sel);
  for (const element of srcset_els) {
    const descs = dom_utils.srcset_parse(element.getAttribute('srcset'));

    let change_count = 0;
    for (const desc of descs) {
      try {
        const url = new URL(desc.url, base_url);
        if (url.href.length !== desc.url.length) {
          desc.url = url.href;
          change_count++;
        }
      } catch (error) {
        // Ignore
      }
    }

    if (change_count) {
      const new_value = dom_utils.srcset_serialize(descs);
      if (new_value) {
        element.setAttribute('srcset', new_value);
      }
    }
  }
}

export function visibility_filter(document, matte, mcr) {
  const body = document.body;
  if (!body) {
    return;
  }

  const elements = body.querySelectorAll('*');
  for (const element of elements) {
    if (body.contains(element) && dom_utils.is_hidden_inline(element)) {
      dom_utils.unwrap_element(element);
    }
  }

  color_contrast_filter(document, matte, mcr);
}
