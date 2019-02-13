import * as dom_utils from '/src/core/dom-utils.js';
import * as net from '/src/core/net.js';
import * as utils from '/src/core/utils.js';
import {assert, AssertionError} from '/src/lib/assert.js';
import * as boilerplate from '/src/lib/boilerplate.js';
import * as color from '/src/lib/color.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';

// Applies several content filters to a document. The filters are applied in a
// logical order that tries to minimize the amount of work done, and to preserve
// correctness.
export async function composite_document_filter(doc, options = {}) {
  assert(doc instanceof Document);
  assert(dom_utils.has_valid_base_uri(doc));
  assert(typeof options === 'object');

  frame_filter(doc);
  body_filter(doc);
  iframe_filter(doc);
  comment_filter(doc);
  visibility_filter(doc, options.contrast_matte, options.contrast_ratio);

  const bad_element_names = [
    'applet', 'audio',  'basefont', 'bgsound', 'command',  'datalist',
    'dialog', 'embed',  'isindex',  'link',    'math',     'meta',
    'object', 'output', 'param',    'path',    'progress', 'spacer',
    'style',  'svg',    'title',    'video',   'xmp'
  ];
  blacklist_filter(doc, bad_element_names);
  script_filter(doc);
  image_lazy_filter(doc);
  url_resolve_filter(doc);
  image_responsive_filter(doc);
  lonestar_filter(doc);
  image_dead_filter(doc);
  await image_size_filter(
      doc, options.image_size_timeout, options.is_allowed_request);
  boilerplate_filter(doc);
  anchor_script_filter(doc);
  image_size_small_filter(doc);
  image_size_large_filter(doc);
  condense_tagnames_filter(doc, false);
  anchor_validity_filter(doc);
  anchor_format_filter(doc);
  form_filter(doc);
  breakrule_filter(doc);
  horizontal_rule_filter(doc);
  format_filter(doc);
  nest_filter(doc);
  semantic_filter(doc);
  figure_filter(doc);
  container_filter(doc);
  list_filter(doc);
  table_filter(doc, options.table_scan_max_rows);
  emphasis_filter(doc, options.emphasis_max_length);
  node_whitespace_filter(doc);
  node_leaf_filter(doc);
  document_trim_filter(doc);
  const attribute_whitelist = {
    a: ['href', 'name', 'title', 'rel'],
    iframe: ['src'],
    source: ['media', 'sizes', 'srcset', 'src', 'type'],
    img: ['src', 'alt', 'title', 'srcset', 'width', 'height']
  };
  attribute_unknown_filter(doc, attribute_whitelist);
  attribute_empty_filter(doc);
  base_filter(doc);
  head_filter(doc);
}

export function anchor_format_filter(doc) {
  const anchors = doc.querySelectorAll('a');
  for (const anchor of anchors) {
    if (!anchor.hasAttribute('href')) {
      dom_utils.unwrap_element(anchor);
    }
  }
}

export function anchor_script_filter(doc) {
  const threshold = 'javascript:'.length;
  const pattern = /^\s*javascript:/i;
  const anchors = doc.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (href && href.length > threshold && pattern.test(href)) {
      dom_utils.unwrap_element(anchor);
    }
  }
}

export function anchor_validity_filter(doc) {
  const pattern = /^\s*https?:\/\/#/i;
  const anchors = doc.querySelectorAll('a');
  for (const anchor of anchors) {
    const href_value = anchor.getAttribute('href');
    if (href_value && pattern.test(href_value)) {
      anchor.remove();
    }
  }
}

export function attribute_empty_filter(doc) {
  for (const element of doc.querySelectorAll('*')) {
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
export function attribute_unknown_filter(doc, whitelist) {
  assert(typeof whitelist === 'object');
  const elements = doc.getElementsByTagName('*');
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

export function base_filter(doc) {
  for (const base of doc.querySelectorAll('base')) {
    base.remove();
  }
}

// |blacklist| is an array of element names.
export function blacklist_filter(doc, blacklist) {
  assert(Array.isArray(blacklist));
  if (blacklist.length < 1) {
    return;
  }

  const elements = doc.querySelectorAll(blacklist.join(','));
  for (const element of elements) {
    if (doc.documentElement.contains(element)) {
      element.remove();
    }
  }
}

// Ensures that a document has a body element
export function body_filter(doc) {
  if (!doc.body) {
    const message = 'This document has no content';
    const error_node = doc.createTextNode(message);
    const body_element = doc.createElement('body');
    body_element.appendChild(error_node);
    doc.documentElement.appendChild(body_element);
  }
}

export function boilerplate_filter(doc, options = {}) {
  let dataset = boilerplate.parse_blocks(doc, boilerplate.neutral_score);
  assert(dataset);
  dataset = boilerplate.extract_features(dataset, options);
  assert(dataset);
  dataset = boilerplate.classify(dataset, boilerplate.score_block);
  assert(dataset);
  for (const row of dataset) {
    if (row.score < boilerplate.neutral_score) {
      const element = boilerplate.find_block_element(doc, row);
      assert(element);
      element.remove();
    }
  }
}

export function breakrule_filter(doc) {
  const subsequent_brs = doc.querySelectorAll('br + br');
  for (const br of subsequent_brs) {
    br.remove();
  }
}

// Removes elements containing text that is not perceptible by calculating the
// approximate contrast between the foreground text color and the background
// color. |matte| is an optional base background color used for alpha blending.
// |min_contrast| is an optional minimum ratio determine whether contrast is too
// low, defaults to a conservative threshold.
export function color_contrast_filter(doc, matte, min_contrast) {
  if (typeof matte === 'undefined') {
    matte = color.WHITE;
  }

  if (typeof min_contrast === 'undefined') {
    min_contrast = 1.2;
  }

  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_TEXT);
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
export function comment_filter(doc) {
  const it =
      doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_COMMENT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

// Replaces certain elements in |doc| with equivalents that use fewer
// characters in the element name, so that when a document it serialized, it
// contains fewer characters. |copy_attrs_flag| is optional boolean specifying
// whether to copy html attributes when replacing an element.
export function condense_tagnames_filter(doc, copy_attrs_flag) {
  const renames = [
    {before: 'strong', after: 'b'}, {before: 'em', after: 'i'},
    {before: 'layer', after: 'div'}
  ];
  for (const rename of renames) {
    const elements = doc.querySelectorAll(rename.before);
    for (const element of elements) {
      dom_utils.coerce_element(element, rename.after, copy_attrs_flag);
    }
  }
}

// Removes container-like elements from the doc
export function container_filter(doc) {
  const elements = doc.querySelectorAll('div, ilayer, layer');
  for (const element of elements) {
    dom_utils.unwrap_element(element);
  }
}

// Filters out emphasis-related elements that are too long. |threshold| is an
// optional cutoff for determining whether an element is over-emphasized, where
// length is whitespace-adjusted.
export function emphasis_filter(doc, threshold = 0) {
  // Bug fix, NaN requires different treatment than undefined
  if (isNaN(threshold)) {
    threshold = 0;
  }

  assert(typeof threshold === 'number');
  assert(Number.isInteger(threshold));
  assert(threshold >= 0);

  if (threshold > 0) {
    const selector = 'b, big, em, i, strong, mark, u';
    const elements = doc.querySelectorAll(selector);
    for (const element of elements) {
      if (element.textContent.replace(/\s+/, '').length > threshold) {
        dom_utils.unwrap_element(element);
      }
    }
  }
}

export function figure_filter(doc) {
  for (const figure of doc.querySelectorAll('figure')) {
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

export function form_filter(doc) {
  const selector =
      'button, fieldset, input, optgroup, option, select, textarea';
  const elements = doc.querySelectorAll(selector);
  for (const element of elements) {
    if (doc.documentElement.contains(element)) {
      element.remove();
    }
  }

  for (const label of doc.querySelectorAll('label')) {
    dom_utils.unwrap_element(label);
  }

  for (const form of doc.querySelectorAll('form')) {
    dom_utils.unwrap_element(form);
  }
}

export function format_filter(doc) {
  const selector = [
    'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
    'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink', 'font',
    'plaintext', 'small', 'tt'
  ].join(',');
  const elements = doc.querySelectorAll(selector);
  for (const element of elements) {
    dom_utils.unwrap_element(element);
  }
}

// Removes frame-related content from a document, including noframes, but
// not iframes.
export function frame_filter(doc) {
  const frameset_element = doc.querySelector('frameset');
  if (!frameset_element) {
    // Still account for malformed cases
    const frame_elements = doc.querySelectorAll('frame');
    for (const frame_element of frame_elements) {
      frame_element.remove();
    }

    const noframes_elements = doc.querySelectorAll('noframes');
    for (const noframes_element of noframes_elements) {
      noframes_element.remove();
    }

    return;
  }


  // If there is a frameset, first look for an existing body element. Do not
  // use the document.body shortcut because it will match frameset. This is
  // trying to handle the malformed html case. If there is a body, clear it out
  // so that it is setup for reuse. If there is no body, create one in replace
  // of the original frameset.

  let body_element = doc.querySelectorAll('body');
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
    body_element = doc.createElement('body');
    // Confusing parameter order note: replaceChild(new child, old child)
    doc.documentElement.replaceChild(body_element, frameset_element);
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
  const elements = doc.querySelectorAll('frame, frameset, noframes');
  for (const element of elements) {
    element.remove();
  }

  // Avoid producing an empty body without an explanation
  if (!body_element.firstChild) {
    const message = 'Unable to display document because it uses HTML frames';
    const node = doc.createTextNode(message);
    body_element.appendChild(node);
  }
}

// Filters certain horizontal rule elements from document content
// Look for all <hr><hr> sequences and remove the second one. Naive in that it
// does not fully account for new document state as hrs removed.
export function horizontal_rule_filter(doc) {
  if (doc.body) {
    const hrs = doc.body.querySelectorAll('hr + hr');
    for (const hr of hrs) {
      hr.remove();
    }
  }
}

export function head_filter(doc) {
  // TODO: clarify whether a document can have multiple head elements by
  // locating and citing the spec
  const head_elements = doc.querySelectorAll('head');
  for (const head_element of head_elements) {
    head_element.remove();
  }
}

export function iframe_filter(doc) {
  const frames = doc.querySelectorAll('iframe');
  for (const frame of frames) {
    frame.remove();
  }
}

// Removes dead images from the document (e.g. no detectable associated url)
export function image_dead_filter(doc) {
  for (const image of doc.querySelectorAll('img')) {
    if (!dom_utils.image_has_source(image)) {
      dom_utils.remove_image(image);
    }
  }
}

// This should occur before canonicalizing urls, because it may set attributes
// that need to be canonicalized that previously did not exist, and would be
// missed by the url_resolve_filter filter. This was previously a bug.
export function image_lazy_filter(doc) {
  const lazy_names = [
    'big-src', 'load-src', 'data-src', 'data-src-full16x9', 'data-src-large',
    'data-original-desktop', 'data-baseurl', 'data-flickity-lazyload',
    'data-lazy', 'data-path', 'data-image-src', 'data-original',
    'data-adaptive-image', 'data-imgsrc', 'data-default-src', 'data-hi-res-src'
  ];

  const images = doc.querySelectorAll('img');
  for (const image of images) {
    if (!dom_utils.image_has_source(image)) {
      const attr_names = image.getAttributeNames();
      for (const name of lazy_names) {
        if (attr_names.includes(name)) {
          const value = image.getAttribute(name);
          if (dom_utils.is_valid_url_string(value)) {
            image.removeAttribute(name);
            image.setAttribute('src', value);
            break;
          }
        }
      }
    }
  }
}

// Set the src/width/height attributes for images that only provide srcset
export function image_responsive_filter(doc) {
  const selector = 'img[srcset]:not([src])';
  const images = doc.querySelectorAll(selector);
  for (const image of images) {
    const descs = dom_utils.srcset_parse(image.getAttribute('srcset'));
    let chosen_desc = null;
    for (const desc of descs) {
      if (desc.url) {
        if (desc.w || desc.h) {
          chosen_desc = desc;
          break;
        } else if (!chosen_desc) {
          chosen_desc = desc;  // continue searching
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

// Tries to set width/height attributes for all images
export function image_size_filter(
    doc, timeout = INDEFINITE, is_allowed_request) {
  assert(doc.baseURI);
  assert(timeout instanceof Deadline);
  const images = doc.querySelectorAll('img');
  const promises = [];
  for (const image of images) {
    const promise = image_size_filter_process_image(
        image, doc, timeout, is_allowed_request);
    promises.push(promise);
  }
  return Promise.all(promises);
}

async function image_size_filter_process_image(
    image, doc, timeout, is_allowed_request) {
  if (image.hasAttribute('width') && image.hasAttribute('height')) {
    return;
  }

  let width = 0, height = 0;

  // Check inline css
  if (image.style && image.hasAttribute('style')) {
    width = parseInt(image.style.width, 10);
    height = parseInt(image.style.height, 10);
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
  if (url.protocol !== 'data:' && exts.includes(utils.url_get_extension(url))) {
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

export function image_size_large_filter(doc) {
  const images = doc.querySelectorAll('img');
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

export function image_size_small_filter(doc) {
  for (const image of doc.querySelectorAll('img')) {
    if (image_is_small(image)) {
      dom_utils.remove_image(image);
    }
  }
}

function image_is_small(image) {
  return image.width > 2 && image.width < 33 && image.height > 2 &&
      image.height < 33;
}

// Remove empty/single-item lists
export function list_filter(doc) {
  assert(typeof doc.baseURI === 'string');
  assert(
      !doc.baseURI.startsWith('chrome-extension:'),
      'bad baseURI somehow ' + doc.baseURI);

  const lists = doc.querySelectorAll('ul, ol, dl');

  for (const list of lists) {
    const parent = list.parentNode;
    if (!parent) {
      continue;
    }

    if (list.firstChild) {
      // The list has one or more child nodes.
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

    dom_utils.unwrap_element(list);
  }
}

// The lonestar filter is tasked with jamming radars. A guide to anti-telemetry
// can be found here: https://youtu.be/rGvblGCD7qM
export function lonestar_filter(doc) {
  assert(doc.baseURI);

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

  const document_url = new URL(doc.baseURI);

  // Remove images that look like telemetry beacons
  const images = doc.querySelectorAll('img');
  for (const image of images) {
    if (lonestar_is_telemetric(image, document_url, host_patterns, false)) {
      dom_utils.remove_image(image);
    }
  }

  // Specify all hyperlink anchors as noreferrer
  const anchors = doc.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }

  // Remove ping attributes from anchors
  const ping_anchors = doc.querySelectorAll('a[ping]');
  for (const anchor of ping_anchors) {
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
export function nest_filter(doc) {
  const hrs_within_lists = doc.querySelectorAll('ul > hr, ol > hr, dl > hr');
  for (const hr of hrs_within_lists) {
    hr.remove();
  }

  const nested_anchors = doc.querySelectorAll('a a');
  for (const descendant_anchor of nested_anchors) {
    dom_utils.unwrap_element(descendant_anchor);
  }

  const captions = doc.querySelectorAll('figcaption');
  for (const caption of captions) {
    if (!caption.parentNode.closest('figure')) {
      caption.remove();
    }
  }

  const sources = doc.querySelectorAll('source');
  for (const source of sources) {
    if (!source.parentNode.closest('audio, picture, video')) {
      source.remove();
    }
  }

  // display-block within display-block-inline
  const block_selector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inline_selector = 'a, span, b, strong, i';

  const blocks = doc.querySelectorAll(block_selector);
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

export function node_leaf_filter(doc) {
  const root = doc.documentElement;
  const elements = doc.querySelectorAll('*');
  for (const element of elements) {
    if (root.contains(element) && dom_utils.node_is_leaf(element)) {
      element.remove();
    }
  }
}

// Filters certain whitespace from node values
export function node_whitespace_filter(doc) {
  const ws_sense = 'code, pre, ruby, script, style, textarea, xmp';
  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const val = node.nodeValue;
    if (val.length > 3 && !node.parentNode.closest(ws_sense)) {
      const new_val = utils.condense_whitespace(val);
      if (new_val.length !== val.length) {
        node.nodeValue = new_val;
      }
    }
  }
}

export function script_filter(doc) {
  const elements = doc.querySelectorAll('noscript, script');
  for (const element of elements) {
    element.remove();
  }
}

export function semantic_filter(doc) {
  const selector = 'article, aside, footer, header, main, section';
  const elements = doc.querySelectorAll(selector);
  for (const element of elements) {
    dom_utils.unwrap_element(element);
  }
}

// Filters certain table elements from document content
export function table_filter(doc, row_scan_max) {
  const elements =
      doc.querySelectorAll('colgroup, hgroup, multicol, tbody, tfoot, thead');
  for (const element of elements) {
    dom_utils.unwrap_element(element);
  }

  const tables = doc.querySelectorAll('table');
  for (const table of tables) {
    const rows = table.rows;
    const limit = Math.min(rows.length, row_scan_max);
    let is_single_column = true;
    for (let i = 0; i < limit && is_single_column; i++) {
      const cells = rows[i].cells;
      let filled = 0;
      for (let j = 0; j < cells.length; j++) {
        if (!dom_utils.node_is_leaf(cells[j])) {
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

export function document_trim_filter(doc) {
  if (doc.body) {
    const first_child = doc.body.firstChild;
    if (first_child) {
      trim_filter_step(first_child, 'nextSibling');
      const last_child = doc.body.lastChild;
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
export function url_resolve_filter(doc) {
  const base_url = new URL(doc.baseURI);
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
  const elements = doc.querySelectorAll(selector);

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

  // TODO: also do this in the first pass somehow, e.g. store * as value in
  // map and that means it is special handling

  const srcset_sel = 'img[srcset], source[srcset]';
  const srcset_els = doc.querySelectorAll(srcset_sel);
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

export function visibility_filter(doc, matte, mcr) {
  const elements = doc.querySelectorAll('*');
  for (const element of elements) {
    if (doc.documentElement.contains(element) &&
        dom_utils.is_hidden_inline(element)) {
      dom_utils.unwrap_element(element);
    }
  }

  // temp disabled debuggin poll hang, problem might be unwrap above
  // color_contrast_filter(doc, matte, mcr);
}