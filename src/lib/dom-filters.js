import {assert, AssertionError} from '/src/lib/assert.js';
import * as boilerplate from '/src/lib/boilerplate.js';
import {coerce_element} from '/src/lib/coerce-element.js';
import {color_contrast_filter} from '/src/lib/color-contrast-filter.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as document_utils from '/src/lib/document-utils.js';
import {node_is_leaf} from '/src/lib/dom-hierarchy.js';
import * as dom_visibility from '/src/lib/dom-visibility.js';
import {fetch_image_element} from '/src/lib/fetch-image-element.js';
import {image_dimensions_filter} from '/src/lib/image-dimensions-filter.js';
import * as image_utils from '/src/lib/image-utils.js';
import * as net from '/src/lib/net.js';
import * as srcset_utils from '/src/lib/srcset-utils.js';
import * as string_utils from '/src/lib/string-utils.js';
import {unwrap_element} from '/src/lib/unwrap-element.js';
import * as url_utils from '/src/lib/url-utils.js';

// Applies several content filters to a document. The filters are applied in a
// logical order that tries to minimize the amount of work done, and to preserve
// correctness.
export async function composite_document_filter(doc, options = {}) {
  assert(doc instanceof Document);
  assert(typeof options === 'object');

  frame_filter(doc, options.empty_frame_body_message);
  ensure_body_element_filter(doc);
  iframe_filter(doc);
  comment_filter(doc);
  visibility_filter(doc, options.contrast_matte, options.contrast_ratio);

  const bad_element_names = [
    'applet', 'audio',  'basefont', 'bgsound', 'command',  'datalist',
    'dialog', 'embed',  'isindex',  'link',    'math',     'meta',
    'object', 'output', 'param',    'path',    'progress', 'spacer',
    'svg',    'title',  'video',    'xmp'
  ];
  blacklist_filter(doc, bad_element_names);
  script_filter(doc);
  image_lazy_filter(doc);
  url_resolve_filter(doc);
  image_responsive_filter(doc);
  lonestar_filter(doc);
  image_dead_filter(doc);
  await image_reachable_filter(doc, options.image_size_timeout);
  await image_dimensions_filter(doc, options.image_size_timeout);
  boilerplate_filter(doc);
  anchor_script_filter(doc);
  image_size_constrain_filter(doc);
  condense_tagnames_filter(doc);
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
  style_filter(doc);
  base_filter(doc);
}

export function anchor_format_filter(doc) {
  const anchors = doc.querySelectorAll('a');
  for (const anchor of anchors) {
    if (!anchor.hasAttribute('href')) {
      unwrap_element(anchor);
    }
  }
}

// Anchors that the browser recognizes as javascript executors will have the
// javascript: protocol. Note the browser tolerates some loose syntax such as
// having leading spaces before the protocol, but does not tolerate space
// between the protocol and its colon. Our goal is performance and to match
// browser behavior. In comparison to other strategies such as using a
// regular expression or CSS starts-with, it is faster and more accurate to
// rely on the browser's native behavior.
//
// The browser recognizes the protocol correctly regardless of the document's
// baseURI, so there is no concern here regarding when this runs in relation to
// other filters, or whether the baseURI was properly initialized.
export function anchor_script_filter(doc) {
  const anchors = doc.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    if (anchor.protocol === 'javascript:') {
      unwrap_element(anchor);
    }
  }
}

export function attribute_empty_filter(doc) {
  // Adapted from https://github.com/kangax/html-minifier/issues/63
  const bool_attr_names = [
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

  const elements = doc.querySelectorAll('*');
  for (const element of elements) {
    const names = element.getAttributeNames();
    for (const name of names) {
      if (!bool_attr_names.includes(name)) {
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

function ensure_body_element_filter(doc) {
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
// contains fewer characters.
export function condense_tagnames_filter(doc) {
  const renames = [
    {before: 'strong', after: 'b'}, {before: 'em', after: 'i'},
    {before: 'layer', after: 'div'}
  ];
  for (const rename of renames) {
    const elements = doc.querySelectorAll(rename.before);
    for (const element of elements) {
      coerce_element(element, rename.after);
    }
  }
}

// Removes container-like elements from the doc
export function container_filter(doc) {
  const elements = doc.querySelectorAll('div, ilayer, layer');
  for (const element of elements) {
    unwrap_element(element);
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

  // Handle redundant nesting, such as strong within strong. Unwrap the child
  // and retain the parent. Use a similar approach to the misnested filter.
  // This belongs here and not in the misnested filter because these nestings
  // do not constitute malformed HTML. The goal here is to shrink the size of
  // the content as much as possible so as to reduce storage, despite the minor
  // decrease in the performance of this filter. In some cases the redundancy
  // is not really redundant if CSS were accurately considered, the author may
  // have been doing something clever or unusual but valid, but since we largely
  // ignore CSS, it becomes redundant as a result.
  const redundants = doc.querySelectorAll(
      'strong strong, strong b, b strong, b b, u u, u em, em u, em em');
  for (const element of redundants) {
    unwrap_element(element);
  }

  if (threshold > 0) {
    const selector = 'b, big, em, i, strong, mark, u';
    const elements = doc.querySelectorAll(selector);
    for (const element of elements) {
      if (element.textContent.replace(/\s+/, '').length > threshold) {
        unwrap_element(element);
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
        unwrap_element(figure);
      }
    } else if (child_count === 0) {
      unwrap_element(figure);
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
    unwrap_element(label);
  }

  for (const form of doc.querySelectorAll('form')) {
    unwrap_element(form);
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
    unwrap_element(element);
  }
}

// Removes frame-related content from a document, including frameset, frame, and
// noframes, but excluding iframes. The |default_message| is displayed when this
// filter results in producing an otherwise empty body element.
export function frame_filter(
    doc, default_message = 'Framed content not supported') {
  const frameset_element = doc.querySelector('frameset');
  if (!frameset_element) {
    // Ensure nothing frame-related is left even without a frameset, and
    // regardless of location in the hierarchy.
    const elements = doc.querySelectorAll('frame, noframes');
    for (const element of elements) {
      element.remove();
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
    // There is both a frameset and a body, which is malformed html. Keep the
    // body and pitch the frameset.
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
    // frameset. This will detach the existing frameset. This assumes there is
    // only one frameset.
    body_element = doc.createElement('body');

    const new_child = body_element;
    const old_child = frameset_element;
    doc.documentElement.replaceChild(new_child, old_child);
  }

  // noframes, if present, should be nested within frameset in well-formed html.
  // Now look for noframes elements within the detached frameset, and if found,
  // move their contents into the body element. I am not sure if there should
  // only be one noframes element or multiple are allowed, so just look for all.
  const noframes_elements = frameset_element.querySelectorAll('noframes');
  for (const e of noframes_elements) {
    for (let node = e.firstChild; node; node = e.firstChild) {
      body_element.appendChild(node);
    }
  }

  // Ensure nothing frame related remains, as a minimal guarantee, given the
  // possibility of malformed html
  const elements = doc.querySelectorAll('frame, frameset, noframes');
  for (const element of elements) {
    element.remove();
  }

  // Avoid producing an empty body without an explanation. Note that we know
  // something frame-related happened because we would have exited earlier
  // without a frameset, so this is not going to affect to the empty-body
  // case in a frameless document.
  if (!body_element.firstChild) {
    const node = doc.createTextNode(default_message);
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

export function iframe_filter(doc) {
  const frames = doc.querySelectorAll('iframe');
  for (const frame of frames) {
    frame.remove();
  }
}

// Removes dead images from the document (e.g. no detectable associated url)
export function image_dead_filter(doc) {
  for (const image of doc.querySelectorAll('img')) {
    if (!image_utils.image_has_source(image)) {
      image_utils.remove_image(image);
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
    if (!image_utils.image_has_source(image)) {
      const attr_names = image.getAttributeNames();
      for (const name of lazy_names) {
        if (attr_names.includes(name)) {
          const value = image.getAttribute(name);
          if (url_utils.is_valid_url_string(value)) {
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
    const descs = srcset_utils.parse(image.getAttribute('srcset'));
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

export function image_reachable_filter(doc, timeout = INDEFINITE) {
  assert(document_utils.has_valid_base_uri(doc));
  assert(timeout instanceof Deadline);

  // Given an image element, inspect its src value and try to fetch the
  // corresponding resource. If successful, stash the width and height in the
  // element for later. If unsuccessful, remove the image.
  async function internal_process_image_helper(image) {
    let url;
    try {
      url = new URL(image.src);
    } catch (error) {
      // TODO: decide what to do about this kind of error. In a sense it also
      // represents an unreachable image and possibly the image should be
      // removed. Keep in mind this may also be redundant with the dead filter,
      // but maybe that has to be that way because filters should error on the
      // side of being naive with respect to what other filters are running.
      console.debug('Ignoring invalid image url', image.src);
      return;
    }

    let result;
    try {
      result = await fetch_image_element(url, timeout);
    } catch (error) {
      if (error instanceof AssertionError) {
        throw error;
      }

      // We want to try to carefully not conflate an image being unreachable
      // because we have no network connection, and an image being unreachable
      // because it really is a 404. If we are offline, we cannot determine
      // reachability, so bail. While we could check connectivity at the start
      // of the filter, that would ignore the possible loss of connectivity
      // during the run. If we did not check for connectivity state, we would
      // incorrectly conclude that all images are unreachable and this would
      // result in removing all images from all articles, which would be bad.
      if (error instanceof net.OfflineError) {
        return;
      }

      // We encountered some other kind of error, such as a timeout error, or
      // a 404, so conclude the image is unreachable.
      image.remove();
      return;
    }

    // If there was no error, then the response was ok, and the image seems
    // reachable (at this time). Stash information in the element so that other
    // filters potentially avoid making network requests. I assume there is only
    // an extremely small risk of collision with real attribute values so this
    // stash technique is probably fine.
    image.setAttribute('data-reachable-width', result.width);
    image.setAttribute('data-reachable-height', result.height);
  }

  const promises = [];
  const images = doc.querySelectorAll('img');
  for (const image of images) {
    promises.push(internal_process_image_helper(image));
  }
  return Promise.all(promises);
}


// Remove or modify images based on size. Assumes images have dimensions.
export function image_size_constrain_filter(doc) {
  const images = doc.querySelectorAll('img');
  for (const image of images) {
    // For large images, remove explicit dimensions to allow for natural
    // dimension precedence and avoid scaling issues in the UI
    if (image.width > 1024 || image.height > 1024) {
      image.removeAttribute('width');
      image.removeAttribute('height');
    } else if (
        image.width > 2 && image.width < 33 && image.height > 2 &&
        image.height < 33) {
      // Remove small images because we assume those images are probably
      // boilerplate, part of a site's template, or telemetry.
      image_utils.remove_image(image);
    }
  }
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
          const item_names = ['dd', 'dt', 'li'];
          if (item_names.includes(firstElement.localName)) {
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

    unwrap_element(list);
  }
}

// The lonestar filter is tasked with jamming radars. A guide to anti-telemetry
// can be found here: https://youtu.be/rGvblGCD7qM
export function lonestar_filter(doc) {
  assert(document_utils.has_valid_base_uri(doc));

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
      image_utils.remove_image(image);
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
  if (dom_visibility.is_hidden_inline(element)) {
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
          if (url_utils.url_get_upper_domain(document_url) !==
              url_utils.url_get_upper_domain(url)) {
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
    unwrap_element(descendant_anchor);
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
    if (root.contains(element) && node_is_leaf(element)) {
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
      const new_val = string_utils.condense_whitespace(val);
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
    unwrap_element(element);
  }
}

// Filters certain table elements from document content
export function table_filter(doc, row_scan_max) {
  const elements =
      doc.querySelectorAll('colgroup, hgroup, multicol, tbody, tfoot, thead');
  for (const element of elements) {
    unwrap_element(element);
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
        if (!node_is_leaf(cells[j])) {
          filled++;
          if (filled > 1) {
            is_single_column = false;
            break;
          }
        }
      }
    }

    if (is_single_column) {
      unwrap_element(table);
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

// Remove style elements. This filter should typically only be called after any
// filters that call getComputedStyle.
export function style_filter(doc) {
  const styles = doc.querySelectorAll('style');
  for (const style of styles) {
    style.remove();
  }
}

// Resolves all element attribute values that contain urls in |document|. Throws
// an error if the document has an invalid base URI.
export function url_resolve_filter(doc) {
  // TODO: some elements have multiple attributes with urls. For example,
  // the new model-viewer attribute also has a poster attribute. There may be
  // some other elements I have ignored too, like some of the attributes for
  // <object> or <embed>.

  assert(document_utils.has_valid_base_uri(doc));

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
    'model-viewer': 'src',
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
    const descs = srcset_utils.parse(element.getAttribute('srcset'));

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
      const new_value = srcset_utils.serialize(descs);
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
        dom_visibility.is_hidden_inline(element)) {
      unwrap_element(element);
    }
  }

  color_contrast_filter(doc, matte, mcr);
}
