import boilerplateFilter from '/src/content-filter/boilerplate-filter.js';
// clang-format off
import {
  assert,
  attribute_is_boolean,
  element_coerce_all,
  element_is_hidden_inline,
  element_unwrap,
  fetch_image_element,
  image_has_source,
  image_remove,
  parse_srcset_wrapper,
  string_condense_whitespace,
  url_is_external,
  url_string_is_valid
} from '/src/content-filter/content-filter-utils.js';
// clang-format on

// TODO: merge most of the filters back into a single module, it is ok to have
// a large file
// TODO: switch to underscore naming (c-style)
// TODO: rename this file, rename apply-all
// TODO: move the next comment to github issue
// TODO: create a new filter that filters out small font text.

// TODO: this comment should be moved to github, labeled as bug
// TODO: not sure where it happens, but whatever removes BRs or certain
// whitespace, should not be removing BRs or line breaks that are descendants
// of <pre>. Or, if it does, it should be leaving behind a single space. Right
// now text nodes separated by BRs in a pre get merged.

// Transforms a document's content by removing or changing nodes for various
// reasons.
// @param document {Document} the document to transform
// @param document_url {URL} the url of the document
// @param fetch_image_timeout {Number} optional, the number of milliseconds to
// wait before timing out when fetching an image
export default async function content_filter_apply_all(
    document, document_url, fetch_image_timeout) {
  assert(document instanceof Document);
  assert(document_url instanceof URL);

  filter_frame_elements(document);

  document_ensure_body_element(document);

  filter_script_elements(document);
  filter_iframe_elements(document);
  filter_comment_nodes(document);
  filter_base_elements(document);

  filter_hidden_elements(document);
  filter_noscript_elements(document);
  filter_blacklisted_elements(document);
  filter_script_anchors(document);

  // This should occur prior to boilerplateFilter because it has express
  // knowledge of content organization
  filter_by_host_template(document, document_url);

  // This should occur before filtering attributes because it makes decisions
  // based on attribute values.
  // This should occur after filtering hidden elements
  boilerplateFilter(document);

  const condense_copy_attrs_flag = false;
  condense_tagnames(document, condense_copy_attrs_flag);

  const emphasis_length_max = 200;
  filter_emphasis_elements(document, emphasis_length_max);

  resolve_document_urls(document, document_url);

  // This should occur prior to lazyImageFilter
  // This should occur prior to imageSizeFilter
  // Does not matter if before or after canonicalizing urls
  filter_responsive_images(document);

  // This should occur before removing images that are missing a src value,
  // because lazily-loaded images often are missign a source value but are
  // still useful
  filter_lazy_images(document);

  // This should occur before setting image sizes to avoid unwanted network
  // requests
  // TODO: change to passing url instead of url string
  filter_telemetry_elements(document, document_url.href);

  // This should occur before trying to set image sizes simply because it
  // potentially reduces the number of images processed later
  filter_sourceless_images(document);

  // It does not matter if this occurs before or after resolving urls. This now
  // accepts a base url parameter and dynamically canonicalizes image urls
  // (without writing back to document). This should occur after removing
  // telemetry, because this involves network requests that perhaps the
  // telemetry filter thinks should be avoided. Allow exceptions to bubble
  await document_set_image_sizes(document, document_url, fetch_image_timeout);

  // This should occur after setting image sizes because it requires knowledge
  // of image size
  filter_small_images(document);


  filter_invalid_anchors(document);
  filter_formatting_anchors(document);
  filter_form_elements(document);
  filter_br_elements(document);
  filter_hr_elements(document);
  filter_formatting_elements(document);
  apply_adoption_agency_filter(document);
  filter_semantic_elements(document);
  filter_figure_elements(document);
  filter_container_elements(document);
  filter_list_elements(document);

  const table_row_scan_max = 20;
  filter_table_elements(document, table_row_scan_max);

  // Better to call later than earlier to reduce number of text nodes visited
  filter_node_whitespace(document);

  // This should be called after most of the other filters. Most of the other
  // filters are naive in how they leave ancestor elements meaningless or empty,
  // and simply remove elements without considering ripple effects. So this is
  // like an additional pass now that several holes have been made.
  filter_leaf_nodes(document);

  // Should be called near end because its behavior changes based on what
  // content remains, and is faster with fewer elements
  document_trim(document);

  // Primarily an attribute filter, so it should be caller as late as possible
  // to reduce the number of elements visited
  add_noreferrer_to_anchors(document);
  remove_ping_attribute_from_all_anchors(document);

  // Filter attributes close to last because it is so slow and is sped up
  // by processing fewer elements.
  const attribute_whitelist = {
    a: ['href', 'name', 'title', 'rel'],
    iframe: ['src'],
    source: ['media', 'sizes', 'srcset', 'src', 'type'],
    img: ['src', 'alt', 'title', 'srcset', 'width', 'height']
  };

  filter_large_image_attributes(document);
  document_filter_non_whitelisted_attributes(document, attribute_whitelist);

  // TODO: move this up to before some of the other attribute filters, or
  // explain why it should occur later
  filter_document_empty_attributes(document);
}

// Removes certain attributes from elements in a document
// @param document {Document}
// @param whitelist {Object} each property is element name, each value is array
// of attribute names
function document_filter_non_whitelisted_attributes(document, whitelist) {
  if (!(document instanceof Document)) {
    throw new TypeError('Invalid document argument ' + document);
  }

  if (whitelist === null || typeof whitelist !== 'object') {
    throw new TypeError('Invalid whitelist argument ' + whitelist);
  }

  // Use getElementsByTagName because there is no concern about removing
  // attributes while iterating over the collection and because it is supposedly
  // faster than querySelectorAll
  const elements = document.getElementsByTagName('*');
  for (const element of elements) {
    element_filter_non_whitelisted_attributes(element, whitelist);
  }
}

function element_filter_non_whitelisted_attributes(element, whitelist) {
  // Use getAttributeNames over element.attributes because:
  // 1) Avoid complexity with changing attributes while iterating over
  // element.attributes
  // 2) Simpler use of for..of
  // 3) For the moment, appears to be faster than iterating element.attributes

  const attribute_names = element.getAttributeNames();
  if (attribute_names.length) {
    const whitelisted_names = whitelist[element.localName] || [];
    for (const attribute_name of attribute_names) {
      if (!whitelisted_names.includes(attribute_name)) {
        element.removeAttribute(attribute_name);
      }
    }
  }
}

// Removes, moves, or otherwise changes certain out-of-place elements in
// document content
function apply_adoption_agency_filter(document) {
  if (!(document instanceof Document)) {
    throw new TypeError('Invalid document ' + document);
  }

  if (!document.body) {
    return;
  }

  // Fix hr in lists. Simple case of invalid parent
  const nestedHRs = document.body.querySelectorAll('ul > hr, ol > hr, dl > hr');
  for (const hr of nestedHRs) {
    hr.remove();
  }

  // Disallow nested anchors. If any anchor has an ancestor anchor, then unwrap
  // the descendant anchor and keep the ancestor.
  const descendantAnchorsOfAnchors = document.body.querySelectorAll('a a');
  for (const descendantAnchor of descendantAnchorsOfAnchors) {
    element_unwrap(descendantAnchor);
  }

  // Remove figcaption elements not tied to a figure
  const captions = document.body.querySelectorAll('figcaption');
  for (const caption of captions) {
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
  const blockSelector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inlineSelector = 'a, span, b, strong, i';

  const blocks = document.body.querySelectorAll(blockSelector);
  for (const block of blocks) {
    const ancestor = block.closest(inlineSelector);
    if (ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for (let node = block.firstChild; node; node = block.firstChild) {
        ancestor.appendChild(node);
      }
      block.appendChild(ancestor);
    }
  }
}

function filter_base_elements(document) {
  assert(document instanceof Document);
  const bases = document.querySelectorAll('base');
  for (const base of bases) {
    base.remove();
  }
}

function filter_br_elements(document) {
  assert(document instanceof Document);
  if (document.body) {
    const brs = document.body.querySelectorAll('br + br');
    for (const br of brs) {
      br.remove();
    }
  }
}

function filter_comment_nodes(document) {
  assert(document instanceof Document);
  const it = document.createNodeIterator(
      document.documentElement, NodeFilter.SHOW_COMMENT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

// Unwraps non-semantic container-like elements
function filter_container_elements(document) {
  assert(document instanceof Document);
  if (document.body) {
    const elements = document.body.querySelectorAll('div, ilayer, layer');
    for (const element of elements) {
      element_unwrap(element);
    }
  }
}


// Unwraps emphasis elements that are longer than the given max length
// @param maxTextLength {Number} optional, integer >= 0,
function filter_emphasis_elements(document, maxTextLength) {
  assert(document instanceof Document);
  const isLengthUndefined = typeof maxTextLength === 'undefined';
  assert(
      isLengthUndefined ||
      (Number.isInteger(maxTextLength) && maxTextLength >= 0));

  // If we don't have a length, which is optional, then there is no benefit to
  // filtering. We cannot use a default like 0 as that would effectively remove
  // all emphasis.
  if (isLengthUndefined) {
    return;
  }

  if (!document.body) {
    return;
  }

  const elements = document.body.querySelectorAll('b, big, em, i, strong');
  for (const element of elements) {
    // TODO: use non-whitespace character count instead of full character count?
    if (element.textContent.length > maxTextLength) {
      element_unwrap(element);
    }
  }
}

// Unwrap captionless figures
function filter_figure_elements(document) {
  assert(document instanceof Document);
  if (document.body) {
    const figures = document.body.querySelectorAll('figure');
    for (const figure of figures) {
      // We can tell a figure is captionless because a captioned element has
      // at least two elements.
      if (figure.childElementCount === 1) {
        // TODO: if the one child is a figcaption, then this should remove
        // the figure rather than unwrap
        element_unwrap(figure);
      }
    }
  }
}

function document_ensure_body_element(document) {
  assert(document instanceof Document);
  if (!document.body) {
    const message = 'This document has no content (missing body).';
    const error_node = document.createTextNode(message);
    const bodyElement = document.createElement('body');
    bodyElement.appendChild(error_node);
    document.documentElement.appendChild(bodyElement);
  }
}

// TODO: use less generic name
const ELEMENT_ATTRIBUTE_MAP = {
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

// TODO: use less generic names
// Initialize ELEMENTS_WITH_SRC_SELECTOR once on module load in module scope
const tags = Object.keys(ELEMENT_ATTRIBUTE_MAP);
const parts = [];
for (const tag of tags) {
  parts.push(`${tag}[${ELEMENT_ATTRIBUTE_MAP[tag]}]`);
}
const ELEMENTS_WITH_SRC_SELECTOR = parts.join(',');

// @param document {Document}
// @param base_url {URL}
function resolve_document_urls(document, base_url) {
  assert(document instanceof Document);
  assert(base_url instanceof URL);

  const srcElements = document.querySelectorAll(ELEMENTS_WITH_SRC_SELECTOR);
  for (const srcElement of srcElements) {
    resolveElementAttribute(srcElement, base_url);
  }

  if (document.body) {
    const srcsetElements =
        document.body.querySelectorAll('img[srcset], source[srcset]');
    for (const srcsetElement of srcsetElements) {
      srcset_resolve(srcsetElement, base_url);
    }
  }
}

function resolveElementAttribute(element, base_url) {
  const attribute_name = ELEMENT_ATTRIBUTE_MAP[element.localName];
  if (!attribute_name) {
    return;
  }

  const originalURLString = element.getAttribute(attribute_name);
  if (!originalURLString) {
    return;
  }

  const resolved_url = url_string_resolve(originalURLString, base_url);
  if (!resolved_url) {
    return;
  }

  // TODO: if this is simply appending the slash, maybe it shouldn't.
  // Technically the slash is implicit, and just a waste of space. Space saving
  // is also a concern. Maybe it should be a concern of a separate filter that
  // removes unimportant characters from urls, or maybe it should just also be
  // a concern of this module? Maybe I do something extra here like just check
  // if path is empty or just a '/', and if so, use .href.substring(-1) or
  // something like that? Maybe that should be encapsulated in some helper
  // function call too, like getCondensedURLString?

  // Also, I think URL serialization leaves in '?' even when parameter count is
  // 0, so maybe also consider that. Also, if I do it here, I should do it for
  // srcset too? Or wait, maybe this is dumb for certain elements that point to
  // actual resources. For example image urls pretty much all have paths. So
  // this is really only for things like anchors? Maybe it really is just too
  // much of a separate concern, but I suppose the aggregate concern is
  // performance, because I suspect using a separate filter would require
  // re-parsing the url. So I really should do it here. For that matter, I
  // should be doing it almost anywhere I set an attribute that contains a url,
  // for those attributes not pointing to files necessarily. Also, if I do the
  // substring thing, I still want to check if length is not equal to avoid the
  // cost of setAttribute. So I have to do two length checks. So maybe what I
  // should do is rewrite this condition to check if lengths equal then return
  // early, otherwise do stuff. The return
  // early style would be consistent with earlier sections of this function.
  // Also maybe store resolved_url.href in a variable like canonicalURLString.
  // It mirrors the variable originalURLString better, and avoids the possible
  // case that Chrome doesn't do lazy-setter-call-memoization?

  // Another note. If I am doing condense, then I may still want to condense
  // the original url EVEN IF it did not change due to canonicalization. So it
  // should not only be done for length change. So the exit early thing would
  // be less convenient, or rather, naive.

  // TODO: separate concern, https://github.com/omidh28/clarifyjs#### should be
  // changed to
  // https://github.com/omidh28/clarifyjs# or just
  // https://github.com/omidh28/clarifyjs

  // TODO: separate idea to explore, what if i have a url-condense-filter that
  // is also site aware and does things like (if stackoverflow keep only the
  // question id part of the url and strip the rest)? At this point I am moving
  // way beyond the concerns of canonicalization and in this sense, it really
  // seems more appropriate to have any condense concerns be apart of this other
  // filter and not here since I am going to just deal with the perf cost of
  // re-parsing. Or, maybe performance is the definining concern, and really,
  // I should be using a more general filter concept like "url-filter.js" that
  // does both canonicalization and condense filters at once, because
  // performance trumps over concern-based organization of functionality?

  if (resolved_url.href.length !== originalURLString.length) {
    // TEMP: monitoring urls for above todo. This is going to spam but I think
    // I will probably focus on the todo rather soon.
    // console.debug('canonicalization change', originalURLString,
    //   resolved_url.href);

    // NOTE: gathering some interesting messages
    // - if url is just '#' then it becomes just full link with # appended. I
    // probably should not be trying to canonical mailto at all.
    // - if url is mailto, it basically just encodes the url (e.g. spaces
    // escaped). Probably should just strip the #? Beware the bug i had last
    // time with google groups urls, a webserver can interpret # as ?
    // - https://play.freeciv.org https://play.freeciv.org/ . So yep, this is
    // exactly the concern, that i talked above above, all that
    // canonicalization accomplished was add a trailing slash.

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

// TODO: maybe inline
function url_string_resolve(url_string, base_url) {
  assert(base_url instanceof URL);

  // Allow for bad input for caller convenience
  // If the url is not a string (e.g. undefined), return undefined
  if (typeof url_string !== 'string') {
    return;
  }

  // Check if url_string is just whitespace. If just whitespace, then return
  // undefined. This departs from the behavior of the URL constructor, which
  // tolerates an empty or whitespace string as input. The url constructor in
  // that case will create a new URL from the base url exclusively.
  // That is misleading for this purpose.

  // If the length of the string is 0 then return undefined
  if (!url_string) {
    return;
  }

  // If the trimmed length of the string is 0 then return undefined
  if (!url_string.trim()) {
    return;
  }

  let canonical_url;
  try {
    canonical_url = new URL(url_string, base_url);
  } catch (error) {
    // Ignore
  }
  return canonical_url;
}


// @param descriptors {Array} an array of descriptors such as those produced
// by parseSrcset
// @returns {String} a string suitable for storing as srcset attribute value
function srcset_serialize(descriptors) {
  assert(Array.isArray(descriptors));

  const descriptor_strings = [];
  for (const descriptor of descriptors) {
    const strings = [descriptor.url];
    if (descriptor.d) {
      strings.push(' ');
      strings.push(descriptor.d);
      strings.push('x');
    } else if (descriptor.w) {
      strings.push(' ');
      strings.push(descriptor.w);
      strings.push('w');
    } else if (descriptor.h) {
      strings.push(' ');
      strings.push(descriptor.h);
      strings.push('h');
    }

    const descriptor_string = strings.join('');
    descriptor_strings.push(descriptor_string);
  }

  return descriptor_strings.join(', ');
}



// Changes the names of certain elements in document content
// TODO: take a look at the following article
// https://blog.usejournal.com/of-svg-minification-and-gzip-21cd26a5d007
// Look into how the html is stored in indexedDB, e.g. what compression, and
// then reconsider if this filter is more harmful than helpful.
// Use shorter names for common elements
// @param copy_attrs_flag {Boolean} optional, if true then copy attributes
// when renaming
function condense_tagnames(document, copy_attrs_flag) {
  assert(document instanceof Document);
  if (!document.body) {
    return;
  }

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
function filter_blacklisted_elements(document) {
  assert(document instanceof Document);
  const document_element = document.documentElement;
  const elements = document.querySelectorAll(blacklisted_element_selector);
  for (const element of elements) {
    if (document_element.contains(element)) {
      element.remove();
    }
  }
}

function filter_document_empty_attributes(document) {
  assert(document instanceof Document);

  if (!document.body) {
    return;
  }

  const elements = document.body.getElementsByTagName('*');
  for (const element of elements) {
    filter_element_empty_attributes(element);
  }
}

function filter_element_empty_attributes(element) {
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
function filter_form_elements(document) {
  assert(document instanceof Document);
  if (!document.body) {
    return;
  }

  const ancestor = document.body;

  // Unwrap forms
  const forms = ancestor.querySelectorAll('form');
  for (const form of forms) {
    element_unwrap(form);
  }

  // Unwrap labels
  const labels = ancestor.querySelectorAll('label');
  for (const label of labels) {
    element_unwrap(label);
  }

  // TODO: add contains check to reduce operations like removing option nested
  // in select removed in prior iteration

  // Remove form fields
  const inputSelector =
      'button, fieldset, input, optgroup, option, select, textarea';
  const inputs = ancestor.querySelectorAll(inputSelector);
  for (const input of inputs) {
    input.remove();
  }
}

// Filters certain anchor elements from document content
// An anchor that acts like a span can be unwrapped. Currently misses anchors
// that have href attr but is empty/whitespace
function filter_formatting_anchors(document) {
  assert(document instanceof Document);
  if (!document.body) {
    return;
  }

  const anchors = document.body.querySelectorAll('a');
  for (const anchor of anchors) {
    if (!anchor.hasAttribute('href')) {
      element_unwrap(anchor);
    }
  }
}

const formatting_elements_selector = [
  'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
  'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink', 'font',
  'plaintext', 'small', 'tt'
].join(',');

// Remove formatting elements
function filter_formatting_elements(document) {
  assert(document instanceof Document);
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
function filter_frame_elements(document) {
  assert(document instanceof Document);
  // It is a bit counterintuitive but if a document is framed then the root
  // frame is its body, and document.body points to it (and not some <body>
  // element)
  let original_body = document.body;

  // If the document has no body or frame element, then there is nothing to do
  if (!original_body) {
    return;
  }

  // If the body element is a body element and not a frame element, then there
  // is nothing to do
  if (original_body.localName !== 'frameset') {
    return;
  }

  // The document is framed, transform into unframed
  let new_body = document.createElement('body');

  // If available, move noframes content into the new body.
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
  // TODO: this assumes the body is always located under the document element, I
  // think that is ok? Should maybe be stricter.
  document.documentElement.replaceChild(new_body, original_body);

  // Remove any frame or frameset elements if somehow any remain
  const frames = document.querySelectorAll('frame, frameset');
  for (const frame of frames) {
    frame.remove();
  }
}

// TODO: make a github issue about optimizing recursive unwrap. I previously
// made several attempts at optimization. Unfortunately much of the code is
// lost. There may still be something in the filter hidden test file. It
// probably belongs in experimental, the test was created before I decided on
// organizing experimental code in a folder.
// TODO: move above comment to github issue

// This does not differentiate between content hidden temporarily and content
// hidden permanently. This looks at content presumably at the time of page
// load. While this has no real knowledge of how other modules work it is
// assumed this is called in a setting where script is disabled and css is
// restricted so there is little possibility of ephemerally hidden content ever
// becoming visible.

// Filters hidden elements from a document
function filter_hidden_elements(document) {
  assert(document instanceof Document);
  const body = document.body;
  if (!body) {
    return;
  }

  // * contains is called to avoid removing descendants of elements detached in
  // prior iterations.
  // * querySelectorAll is used over getElementsByTagName to simplify removal
  // during iteration.

  // This works top-down, which is why each visibility check ignores whether
  // ancestors are visible. Once an ancestor is removed, body no longer contains
  // it, so there is no longer a concern of duplicate evaluation.

  const elements = body.querySelectorAll('*');
  for (const element of elements) {
    if (body.contains(element) && element_is_hidden_inline(element)) {
      element_unwrap(element);
    }
  }
}

// @param document {Document}
// @param url {URL}
function filter_by_host_template(document, url) {
  assert(document instanceof Document);
  if (!url) {
    return;
  }

  // TODO: host_selector_map should be a parameter to this function so that
  // configuration is defined externally so that it can be changed without
  // needing to modify its internals (open-closed principle)

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
function filter_hr_elements(document) {
  assert(document instanceof Document);

  if (!document.body) {
    return;
  }

  const hrs = document.body.querySelectorAll('hr + hr');
  for (const hr of hrs) {
    hr.remove();
  }
}

// Filters iframe elements from document content
function filter_iframe_elements(document) {
  assert(document instanceof Document);
  if (!document.body) {
    return;
  }

  const iframes = document.body.querySelectorAll('iframe');
  for (const iframe of iframes) {
    iframe.remove();
  }
}

// TODO: use console parameter pattern to enable/disable logging
// TODO: consider using document.baseURI over explicit base_url
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
async function document_set_image_sizes(document, base_url, timeout) {
  assert(document instanceof Document);
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

  // Concurrently get dimensions for each image
  const promises = [];
  for (const image of images) {
    promises.push(image_get_dimensions(image, base_url, timeout));
  }

  // Update the DOM for images that need state change
  const results = await Promise.all(promises);
  for (const result of results) {
    if ('width' in result) {
      result.image.setAttribute('width', '' + result.width);
      result.image.setAttribute('height', '' + result.height);
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
    return;
  }

  // NOTE: this assumes image source url is canonical.

  // Parsing the url can throw an error. image_get_dimensions should not throw
  // except in the case of a programming error.
  let source_url;
  try {
    source_url = new URL(image_source, base_url);
  } catch (error) {
    // If we cannot parse the url, then we cannot reliably inspect
    // the url for dimensions, nor fetch the image, so we're done.
    return {image: image, reason: 'invalid-src'};
    return;
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



// Returns a file name without its extension (and without the '.')
function file_name_filter_extension(file_name) {
  assert(typeof file_name === 'string');
  const index = file_name.lastIndexOf('.');
  return index < 0 ? file_name : file_name.substring(0, index);
}

function url_get_filename(url) {
  assert(url instanceof URL);
  const index = url.pathname.lastIndexOf('/');
  if ((index > -1) && (index + 1 < url.pathname.length)) {
    return url.pathname.substring(index + 1);
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
function filter_invalid_anchors(document) {
  assert(document instanceof Document);
  if (!document.body) {
    return;
  }

  const anchors = document.body.querySelectorAll('a');
  for (const anchor of anchors) {
    if (anchor_is_invalid(anchor)) {
      anchor.remove();
    }
  }
}

// Returns true if the anchor has an invalid href
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
function filter_large_image_attributes(document) {
  assert(document instanceof Document);
  if (!document.body) {
    return;
  }

  const images = document.body.querySelectorAll('img');
  for (const image of images) {
    if (isLargeImage(image)) {
      image.removeAttribute('width');
      image.removeAttribute('height');
    }
  }
}

function isLargeImage(image) {
  const widthString = image.getAttribute('width');
  if (!widthString) {
    return false;
  }

  const heightString = image.getAttribute('height');
  if (!heightString) {
    return false;
  }

  const widthInt = parseInt(widthString, 10);
  if (isNaN(widthInt)) {
    return false;
  } else if (widthInt > 1000) {
    return true;
  }

  const heightInt = parseInt(heightString, 10);
  if (isNaN(heightInt)) {
    return false;
  } else if (heightInt > 1000) {
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
function filter_lazy_images(document) {
  assert(document instanceof Document);
  if (!document.body) {
    return;
  }

  const images = document.body.getElementsByTagName('img');

  for (const image of images) {
    if (image_has_source(image)) {
      continue;
    }

    const attribute_names = image.getAttributeNames();

    for (const lazyAttributeName of lazy_image_attribute_names) {
      if (attribute_names.includes(lazyAttributeName)) {
        const lazyAttributeValue = image.getAttribute(lazyAttributeName);
        if (url_string_is_valid(lazyAttributeValue)) {
          lazy_image_transform(image, lazyAttributeName, lazyAttributeValue);
          break;
        }
      }
    }
  }
}

function lazy_image_transform(image, lazyAttributeName, lazyAttributeValue) {
  // const before = image.outerHTML;

  // Remove the lazy attribute, it is no longer needed.
  image.removeAttribute(lazyAttributeName);

  // Create a src, or replace whatever is in the current src, with the value
  // from the lazy attribute.
  image.setAttribute('src', lazyAttributeValue);

  // const after = image.outerHTML;
  // console.debug('lazy_image_transform', before, after);
}



// Filters empty leaf-like nodes from document content
// TODO: remove near empty anchor elements, e.g. only containing whitespace
// text nodes, that result from removing nested elements in other filters. Or
// at least investigate why it isn't getting removed, because it looks like it
// should be. Or the problem is that this doesn't consider the ripple effect of
// how removing a leaf leads to other leaves? The problem occurs at
// http://freakonomics.com/podcast/make-match-rebroadcast/

function filter_leaf_nodes(document) {
  assert(document instanceof Document);

  if (!document.body) {
    return;
  }

  const documentElement = document.documentElement;
  const elements = document.body.querySelectorAll('*');
  for (const element of elements) {
    if (documentElement.contains(element) && node_is_leaf(element)) {
      element.remove();
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
function element_is_leaf_exception(element) {
  return leaf_exception_element_names.includes(element.localName);
}



// Filters certain list elements from document content


// TODO: restrict children of list to proper child type. E.g. only allow li or
// form within ul/ol, and dd/dt/form within dl. Do some type of transform like
// move such items to within a new child
function filter_list_elements(doc) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  const ancestor = doc.body;
  const lists = ancestor.querySelectorAll('ul, ol, dl');

  // TODO: maybe this empty checking should be moved into the leafFilterIsLeaf
  // logic as a special case for list elements. That way it will be recursive.
  // But this does a moving of children where as the leaf code just removes. So
  // that would also entail changing the meaning of leaf filtering from filter
  // to transform.
  for (const list of lists) {
    if (isEmptyList(list)) {
      removeEmptyList(list);
    }
  }

  for (const list of lists) {
    unwrapSingleItemList(list);
  }
}

// Return true if list is 'empty'
function isEmptyList(list) {
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

function removeEmptyList(list) {
  const doc = list.ownerDocument;

  // Add leading padding
  if (list.previousSibling &&
      list.previousSibling.nodeType === Node.TEXT_NODE) {
    list.parentNode.insertBefore(doc.createTextNode(' '), list);
  }

  const firstChild = list.firstChild;

  // Move any child nodes (there may be none). As each first child is moved,
  // the next child becomes the first child.
  for (let node = firstChild; node; node = list.firstChild) {
    list.parentNode.insertBefore(node, list);
  }

  // Add trailing padding if needed. Also check if there were children, so as
  // to not add padding on top of the leading padding when there is no need.
  if (firstChild && list.nextSibling &&
      list.nextSibling.nodeType === Node.TEXT_NODE) {
    list.parentNode.insertBefore(doc.createTextNode(' '), list);
  }

  list.remove();
}

// Unwraps single item or empty list elements
function unwrapSingleItemList(list) {
  const listParent = list.parentNode;
  if (!listParent) {
    return;
  }

  const doc = list.ownerDocument;
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
  const listItemNames = {li: 0, dt: 0, dd: 0};
  if (!(item.localName in listItemNames)) {
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
      listParent.replaceChild(doc.createTextNode(' '), list);

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
    listParent.insertBefore(doc.createTextNode(' '), list);
  }

  // Move the children of the item to before the list, maintainin order
  for (let node = item.firstChild; node; node = item.firstChild) {
    listParent.insertBefore(node, list);
  }

  // Add trailing padding
  if (list.nextSibling && list.nextSibling.nodeType === Node.TEXT_NODE &&
      list.previousSibling &&
      list.previousSibling.nodeType === Node.TEXT_NODE) {
    listParent.insertBefore(doc.createTextNode(' '), list);
  }

  list.remove();
}



// Filters certain whitespace from a document. This scans the text nodes of a
// document and modifies certain text nodes.

function filter_node_whitespace(doc) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  // Ignore node values shorter than this length
  const minNodeValueLength = 3;

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    if (value.length > minNodeValueLength && !node_is_ws_sensitive(node)) {
      const new_value = string_condense_whitespace(value);

      if (new_value.length !== value.length) {
        node.nodeValue = new_value;
      }
    }
  }
}

function node_is_ws_sensitive(node) {
  return node.parentNode.closest(
      'code, pre, ruby, script, style, textarea, xmp');
}


// Specifies that all links are noreferrer
// TODO: this function's behavior conflicts with attribute filter. Need to
// whitelist this attribute (and this value) for this element.
function add_noreferrer_to_anchors(doc) {
  assert(doc instanceof Document);

  if (!doc.body) {
    return;
  }

  const anchors = doc.body.getElementsByTagName('a');
  for (const anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }
}


// Transforms noscript content in document content
function filter_noscript_elements(doc) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  const noscripts = doc.body.querySelectorAll('noscript');
  for (const noscript of noscripts) {
    element_unwrap(noscript);
  }
}

// Removes ping attributes from anchor elements in document content
function remove_ping_attribute_from_all_anchors(doc) {
  assert(doc instanceof Document);

  if (!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[ping]');
  for (const anchor of anchors) {
    anchor.removeAttribute('ping');
  }
}



// Transforms responsive images in document content

// An image is 'responsive' if it uses a srcset instead of a src, such that the
// actual image used is derived dynamically after the document has been loaded.
// This filter looks for such images and changes them to use one of the
// descriptors from the srcset as the src.

function filter_responsive_images(doc) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  const images = doc.body.getElementsByTagName('img');
  for (const image of images) {
    if (!image.hasAttribute('src') && image.hasAttribute('srcset')) {
      const descriptor = findBestSrcsetDescriptorForImage(image);
      if (descriptor) {
        transformImageToDescriptor(image, descriptor);
      } else {
        console.debug('Could not find descriptor for image', image.outerHTML);
      }
    }
  }
}

// Selects the best srcset to use from an image's srcset attribute value.
// Returns the parsed descriptor object. Returns undefined if no descriptor
// found
function findBestSrcsetDescriptorForImage(image) {
  const srcsetValue = image.getAttribute('srcset');
  if (!srcsetValue) {
    return;
  }

  const descriptors = parse_srcset_wrapper(srcsetValue);

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
function transformImageToDescriptor(image, descriptor) {
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
function filter_script_anchors(document) {
  assert(document instanceof Document);
  if (!document.body) {
    return;
  }

  const anchors = document.body.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    if (url_string_has_script_protocol(anchor.getAttribute('href'))) {
      element_unwrap(anchor);
    }
  }
}

// For a url string to have the script protocol it must be longer than this
const JS_PREFIX_LEN = 'javascript:'.length;

// Returns true if the url has the 'javascript:' protocol. Does not throw in
// the case of bad input. Tolerates leading whitespace.
function url_string_has_script_protocol(url_string) {
  // The type check is done to allow for bad inputs for caller convenience. The
  // length check is an attempt to reduce the number of regex calls.
  return typeof url_string === 'string' && url_string.length > JS_PREFIX_LEN &&
      /^\s*javascript:/i.test(url_string);
}


// Removes script elements from document content
function filter_script_elements(doc) {
  assert(doc instanceof Document);

  const scripts = doc.querySelectorAll('script');
  for (const script of scripts) {
    script.remove();
  }
}

function filter_small_images(doc) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  const images = doc.body.querySelectorAll('img');
  for (const image of images) {
    if (isSmallImage(image)) {
      image_remove(image);
    }
  }
}

// TODO: merge this with isLargeImage, make a function that does something like
// image_bin_size, and returns small or large or other. Then deprecate
// isSmallImage and isLargeImage
function isSmallImage(image) {
  const widthString = image.getAttribute('width');
  if (!widthString) {
    return false;
  }

  const heightString = image.getAttribute('height');
  if (!heightString) {
    return false;
  }

  const widthInt = parseInt(widthString, 10);
  if (isNaN(widthInt)) {
    return false;
  }

  const heightInt = parseInt(heightString, 10);
  if (isNaN(heightInt)) {
    return false;
  }

  if (widthInt < 3) {
    return false;
  }

  if (heightInt < 3) {
    return false;
  }

  if (widthInt < 33 && heightInt < 33) {
    // console.debug('Small image detected', image.outerHTML);
    return true;
  }

  return false;
}


// Filter semantic web elements from document content
function filter_semantic_elements(document) {
  assert(document instanceof Document);
  if (document.body) {
    const selector = 'article, aside, footer, header, main, section';
    const elements = document.body.querySelectorAll(selector);
    for (const element of elements) {
      element_unwrap(element);
    }
  }
}


// Removes images that are missing source information from document content
function filter_sourceless_images(doc) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  // Use querySelectorAll over getElementsByTagName to simplify removal during
  // iteration.

  const images = doc.body.querySelectorAll('img');
  for (const image of images) {
    if (!image_has_source(image)) {
      // console.debug('Removing image', image.outerHTML);
      image_remove(image);
    }
  }
}


// Remove whitespace and whitespace-like content from the start and end of a
// document's body.
function document_trim(doc) {
  if (!(doc instanceof Document)) {
    throw new TypeError('Invalid document parameter', doc);
  }

  if (!doc.body) {
    return;
  }

  const firstChild = doc.body.firstChild;
  if (firstChild) {
    trim_document_step(firstChild, 'nextSibling');
    const lastChild = doc.body.lastChild;
    if (lastChild && lastChild !== firstChild) {
      trim_document_step(lastChild, 'previousSibling');
    }
  }
}

function trim_document_step(startNode, edgeName) {
  let node = startNode;
  while (node && node_is_trimmable(node)) {
    const sibling = node[edgeName];
    node.remove();
    node = sibling;
  }
}

function node_is_trimmable(node) {
  // Leave it up to the engine to determine if this is a hotspot that needs
  // hoisting
  const spaceElements = ['br', 'hr', 'nobr'];

  if (node.nodeType === Node.TEXT_NODE) {
    return !node.nodeValue.trim();
  } else {
    return spaceElements.includes(node.localName);
  }
}



// Filters certain table elements from document content
function filter_table_elements(doc, scanLimit) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  const elements = doc.body.querySelectorAll(
      'colgroup, hgroup, multicol, tbody, tfoot, thead');
  for (const element of elements) {
    element_unwrap(element);
  }

  const tables = doc.body.querySelectorAll('table');
  for (const table of tables) {
    if (isSingleColumnTable(table, scanLimit)) {
      unwrapTable(table);
    }
  }
}

function isSingleColumnTable(table, scanLimit) {
  const rows = table.rows;
  const safeLimit = Math.min(rows.length, scanLimit);
  for (let i = 0; i < safeLimit; i++) {
    if (!isSingleColumnRow(rows[i])) {
      return false;
    }
  }
  return true;
}

function isSingleColumnRow(row) {
  const cells = row.cells;
  let nonEmptyCellCount = 0;
  for (let i = 0, len = cells.length; i < len; i++) {
    if (!node_is_leaf(cells[i]) && ++nonEmptyCellCount > 1) {
      return false;
    }
  }

  return true;
}

function unwrapTable(table) {
  const rows = table.rows;
  const rowCount = rows.length;
  const parent = table.parentNode;
  const doc = table.ownerDocument;

  parent.insertBefore(doc.createTextNode(' '), table);

  for (let i = 0; i < rowCount; i++) {
    const row = rows[i];
    for (let j = 0, clen = row.cells.length; j < clen; j++) {
      const cell = row.cells[j];

      // Move the children of the cell to before the table
      for (let node = cell.firstChild; node; node = cell.firstChild) {
        parent.insertBefore(node, table);
      }
    }

    parent.insertBefore(doc.createElement('p'), table);
  }

  parent.insertBefore(doc.createTextNode(' '), table);
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



// TODO: switch to accepting url object instead of url string

// Removes some telemetry data from a document.
// @param doc {Document}
// @param url {String} canonical document url
function filter_telemetry_elements(doc, documentURLString) {
  assert(doc instanceof Document);

  // Analysis is limited to descendants of body
  if (!doc.body) {
    return;
  }


  // Build document url. Implicitly this also validates that the url is
  // canonical.
  // If this fails this throws a type error, which is a kind of assertion
  // error but it is expected
  // here, but it should never happen. Anyway this is a mess and eventually
  // I should just accept a URL as input instead of a string
  assert(typeof documentURLString === 'string' && documentURLString.length > 0);
  const documentURL = new URL(documentURLString);



  // TODO: when checking image visibility, should I be checking ancestry? Or
  // just the image itself?

  // Telemetry images are usually hidden, so treat visibility as an indicator.
  // False positives are probably not too harmful. Removing images based on
  // visibility overlaps with sanitization, but this is intentionally naive
  // regarding what other filters are applied to the document.
  const images = doc.body.querySelectorAll('img');
  for (const image of images) {
    if (element_is_hidden_inline(image) || image_is_pixel(image) ||
        image_has_telemetry_source(image, documentURL)) {
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
// @param documentURL {URL}
function image_has_telemetry_source(image, documentURL) {
  assert(image instanceof Element);
  if (!image.hasAttribute('src')) {
    return false;
  }

  const src = image.getAttribute('src').trim();
  if (!src) {
    return false;
  }

  // TODO: does HTMLImageElement provide URL-like properties, similar to
  // HTMLAnchorElement?

  // TODO: all these attempts to avoid parsing are probably silly when it
  // isn't even clear
  // This is slow. Just parse the url. It is simpler. This was premature
  // optimization

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
  if (!url_is_external(documentURL, imageURL)) {
    return false;
  }

  for (const pattern of telemetry_host_patterns) {
    if (pattern.test(src)) {
      return true;
    }
  }

  return false;
}
