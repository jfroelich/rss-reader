import assert from '/src/assert.js';
import {unwrap_element} from '/src/dom-filters/utils/unwrap-element.js';
import * as image_utils from '/src/dom-filters/utils/image-utils.js';
import {node_is_leaf} from '/src/dom-filters/node-is-leaf.js';
import * as string from '/src/string-utils.js';
import {color_contrast_filter} from '/src/dom-filters/color-contrast-filter/color-contrast-filter.js';
import {is_hidden_inline} from '/src/dom-filters/utils/visibility.js';
import * as attribute_utils from '/src/dom-filters/utils/attribute-utils.js';


export function anchor_format_filter(document) {
  if (document.body) {
    const anchors = document.body.querySelectorAll('a');
    for (const anchor of anchors) {
      if (!anchor.hasAttribute('href')) {
        unwrap_element(anchor);
      }
    }
  }
}

export function anchor_script_filter(document) {
  const href_length_min_threshold = 'javascript:'.length;

  // This pattern is compared against an href attribute value. If it matches
  // then the function concludes the anchor is a script anchor. Leading
  // whitespace is allowed. However, whitespace preceding the colon is not
  // allowed. I believe this matches browser behavior.
  // TODO: write a test that explicitly checks matching of browser behavior
  const pattern = /^\s*javascript:/i;

  // This makes no assumption the document is well-formed, as in, has an html
  // body tag. Analysis is restricted to body. If no body then nothing to do. I
  // assume that an anchor outside of the body is not displayed. This actually
  // might be inaccurate if the browser does things like shift in-body-only
  // elements that are located outside of body into body.
  if (!document.body) {
    return;
  }

  // Using a selector that includes the attribute qualifier matches fewer
  // anchors then the general anchor selector. An anchor without an href is of
  // no concern here. Doing the has-href check here is substantially faster
  // than calling getAttribute. getAttribute is surprisingly slow.
  const anchor_selector = 'a[href]';
  const anchors = document.body.querySelectorAll(anchor_selector);

  // The href test avoids the case of a no-value attribute and empty string
  // The length check reduces the number of expensive calls to regex.test
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (href && href.length > href_length_min_threshold && pattern.test(href)) {
      unwrap_element(anchor);
    }
  }
}

export function anchor_validity_filter(document) {
  const invalid = /^\s*https?:\/\/#/i;

  if (document.body) {
    const anchors = document.body.querySelectorAll('a');
    for (const anchor of anchors) {
      const href_value = anchor.getAttribute('href');
      if (href_value && invalid.test(href_value)) {
        anchor.remove();
      }
    }
  }
}

// TODO: rename to something like attribute-value-filter, or
// attribute-value-length-filter?
// TODO: consider aggregating with other attribute filters
export function attribute_empty_filter(document) {
  if (document.body) {
    const elements = document.body.getElementsByTagName('*');
    for (const element of elements) {
      const names = element.getAttributeNames();
      for (const name of names) {
        if (!attribute_utils.is_boolean(element, name)) {
          const value = element.getAttribute(name);
          if (typeof value !== 'string' || !value.trim()) {
            element.removeAttribute(name);
          }
        }
      }
    }
  }
}

// Removes certain attributes from all elements in a document.
// This applies to the whole document, not just body.
// @param whitelist {Object} each property is element name, each value is array
// of retainable attribute names
// TODO: rename to something like attribute-name-whitelist-filter?
export function attribute_unknown_filter(document, whitelist) {
  assert(typeof whitelist === 'object');
  // Not restricted to body
  const elements = document.getElementsByTagName('*');
  for (const element of elements) {
    filter_element_unknown_attributes(element, whitelist);
  }
}

function filter_element_unknown_attributes(element, whitelist) {
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

export function base_filter(document) {
  // Not restricted to body
  const bases = document.querySelectorAll('base');
  for (const base of bases) {
    base.remove();
  }
}

// Filters blacklisted elements from document content.
// @param blacklist {Array} an array of names of elements, each name should be
// a string that corresponds to what would be used in a selector to match an
// element using querySelectorAll
export function blacklist_filter(document, blacklist) {
  // Exit early when there is no work to do. Tolerate bad param (Postel).
  if(!Array.isArray(blacklist) || blacklist.length < 1) {
    return;
  }

  // Find all occurrences of all element names in the list and remove them
  const document_element = document.documentElement;
  const selector = blacklist.join(',');
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    if (document_element.contains(element)) {
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

// Remove consecutive <br>s
export function breakrule_filter(document) {
  if (document.body) {
    const brs = document.body.querySelectorAll('br + br');
    for (const br of brs) {
      br.remove();
    }
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

// Removes container-like elements from the document
export function container_filter(document) {
  if (document.body) {
    const elements = document.body.querySelectorAll('div, ilayer, layer');
    for (const element of elements) {
      unwrap_element(element);
    }
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

  // Analysis is restricted to elements within body.
  if (!document.body) {
    return;
  }

  const selector = 'b, big, em, i, strong, mark, u';
  const elements = document.body.querySelectorAll(selector);
  for (const element of elements) {
    const no_ws = element.textContent.replace(/\s+/, '');
    if (no_ws.length > max_length_threshold) {
      unwrap_element(element);
    }
  }
}

export function figure_filter(document) {
  if (document.body) {
    const figures = document.body.querySelectorAll('figure');
    for (const figure of figures) {
      const child_count = figure.childElementCount;
      if (child_count === 1) {
        if (figure.firstElementChild.localName === 'figcaption') {
          figure.remove();
        } else {
          unwrap_element(figure);
        }
      } else if (child_count === 0) {
        unwrap_element(figure);
      }
    }
  }
}

// Removes or changes form-related elements from the document
export function form_filter(document) {
  // Note I am not certain whether document.body is cached. I assume it is, but
  // I later do a potentially large amount of removals and have some paranoia.
  // For now, given the separate benefit of using a shorter alias, I cache it
  // in a local variable.
  const body = document.body;

  // This analysis is restricted to the content area of the document. If there
  // is no content area as designated by body then there is nothing to do.
  if (!body) {
    return;
  }

  // The form element itself often contains a substantial amount of actual
  // real content, so removing it would be data loss. So unwrap instead.
  const forms = body.querySelectorAll('form');
  for (const form of forms) {
    unwrap_element(form);
  }

  // It isn't really clear to me whether labels should stay or go, but for now,
  // error on the safe side and unwrap instead of remove.
  // TODO: eventually revisit. It may be stupid to leave labels visible when the
  // thing they correspond to no longer exists.
  const labels = body.querySelectorAll('label');
  for (const label of labels) {
    unwrap_element(label);
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
      unwrap_element(element);
    }
  }
}

// Removes frame-related content from a document, including noframes content,
// but excluding iframe-related content.
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
      if (!image_utils.image_has_source(image)) {
        image_utils.remove_image(image);
      }
    }
  }
}

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
      if (!image_utils.image_has_source(image)) {
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
// TODO: move to utils
function is_valid_url_string(value) {
  // The upper bound on len is an estimate, kind of a safeguard, hopefully never
  // causes a problem
  return typeof value === 'string' && value.length > 1 &&
      value.length <= 3000 && !value.trim().includes(' ');
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
    unwrap_element(descendant_anchor);
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
      if (root.contains(element) && node_is_leaf(element)) {
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
      const new_value = string.condense_whitespace(value);
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

// Filter semantic web elements from document content
export function semantic_filter(document) {
  if (document.body) {
    const selector = 'article, aside, footer, header, main, section';
    const elements = document.body.querySelectorAll(selector);
    for (const element of elements) {
      unwrap_element(element);
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

export function visibility_filter(document, matte, mcr) {
  const body = document.body;
  if (!body) {
    return;
  }

  const elements = body.querySelectorAll('*');
  for (const element of elements) {
    if (body.contains(element) && is_hidden_inline(element)) {
      unwrap_element(element);
    }
  }

  color_contrast_filter(document, matte, mcr);
}
