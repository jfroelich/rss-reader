import {url_is_allowed} from '/src/common/fetch-utils.js';
import boilerplateFilter from '/src/content-filter/boilerplate-filter.js';
// clang-format off
import {
  assert,
  attribute_is_boolean,
  element_coerce_all,
  element_is_hidden_inline,
  // TODO: not in use?
  element_is_void,
  // TODO: not in use?
  element_move_child_nodes,
  element_unwrap,
  fetch_image_element,
  parse_srcset_wrapper
} from '/src/content-filter/content-filter-utils.js';
// clang-format on

import invalidAnchorFilter from '/src/content-filter/invalid-anchor-filter.js';
import largeImageAttributeFilter from '/src/content-filter/large-image-attribute-filter.js';
import lazyImageFilter from '/src/content-filter/lazy-image-filter.js';
import {leafFilter} from '/src/content-filter/leaf-filter.js';
import listFilter from '/src/content-filter/list-filter.js';
import lonestarFilter from '/src/content-filter/lonestar-filter.js';
import nodeWhitespaceFilter from '/src/content-filter/node-whitespace-filter.js';
import noreferrerFilter from '/src/content-filter/noreferrer-filter.js';
import noscriptFilter from '/src/content-filter/noscript-filter.js';
import pingFilter from '/src/content-filter/ping-filter.js';
import responsiveImageFilter from '/src/content-filter/responsive-image-filter.js';
import scriptAnchorFilter from '/src/content-filter/script-anchor-filter.js';
import scriptFilter from '/src/content-filter/script-filter.js';
import semanticFilter from '/src/content-filter/semantic-filter.js';
import smallImageFilter from '/src/content-filter/small-image-filter.js';
import sourcelessImageFilter from '/src/content-filter/sourceless-image-filter.js';
import tableFilter from '/src/content-filter/table-filter.js';
import trimDocumentFilter from '/src/content-filter/trim-document-filter.js';

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

  ensureDocumentHasBodyElement(document);

  scriptFilter(document);
  filter_iframe_elements(document);
  filterCommentNodes(document);
  filterBaseElements(document);

  filter_hidden_elements(document);
  noscriptFilter(document);
  filter_blacklisted_elements(document);
  scriptAnchorFilter(document);

  // This should occur prior to boilerplateFilter because it has express
  // knowledge of content organization
  filter_by_host_template(document, document_url);

  // This should occur before filtering attributes because it makes decisions
  // based on attribute values.
  // This should occur after filtering hidden elements
  boilerplateFilter(document);

  const copyAttributesOnCondense = false;
  condense_tagnames(document, copyAttributesOnCondense);

  const maxEmphasisTextLength = 200;
  filterEmphasis(document, maxEmphasisTextLength);

  resolve_document_urls(document, document_url);

  // This should occur prior to lazyImageFilter
  // This should occur prior to imageSizeFilter
  // Does not matter if before or after canonicalizing urls
  responsiveImageFilter(document);

  // This should occur before removing images that are missing a src value,
  // because lazily-loaded images often are missign a source value but are
  // still useful
  lazyImageFilter(document);

  // This should occur before setting image sizes to avoid unwanted network
  // requests
  // TODO: change to passing url instead of url string
  lonestarFilter(document, document_url.href);

  // This should occur before trying to set image sizes simply because it
  // potentially reduces the number of images processed later
  sourcelessImageFilter(document);

  // It does not matter if this occurs before or after resolving urls. This now
  // accepts a base url parameter and dynamically canonicalizes image urls
  // (without writing back to document). This should occur after removing
  // telemetry, because this involves network requests that perhaps the
  // telemetry filter thinks should be avoided. Allow exceptions to bubble
  await applyImageSizeFilter(document, document_url, fetch_image_timeout);

  // This should occur after setting image sizes because it requires knowledge
  // of image size
  smallImageFilter(document);


  invalidAnchorFilter(document);
  filter_formatting_anchors(document);
  filter_form_elements(document);

  filterBRElements(document);

  filter_hr_elements(document);
  filter_formatting_elements(document);
  applyAdoptionAgencyFilter(document);
  semanticFilter(document);
  filterFigureElements(document);
  filterContainerElements(document);

  listFilter(document);

  const rowScanLimit = 20;
  tableFilter(document, rowScanLimit);

  // Better to call later than earlier to reduce number of text nodes visited
  nodeWhitespaceFilter(document);

  // This should be called near the end. Most of the other filters are naive in
  // how they leave ancestor elements meaningless or empty, and simply remove.
  // So this is like an additional pass now that several holes have been made.
  leafFilter(document);

  // Should be called near end because its behavior changes based on what
  // content remains, and is faster with fewer elements
  trimDocumentFilter(document);

  // Primarily an attribute filter, so it should be caller as late as possible
  // to reduce the number of elements visited
  noreferrerFilter(document);
  pingFilter(document);

  // Filter attributes close to last because it is so slow and is sped up
  // by processing fewer elements.
  const attributeWhitelist = {
    a: ['href', 'name', 'title', 'rel'],
    iframe: ['src'],
    source: ['media', 'sizes', 'srcset', 'src', 'type'],
    img: ['src', 'alt', 'title', 'srcset', 'width', 'height']
  };

  largeImageAttributeFilter(document);
  applyAttributeWhitelistFilter(document, attributeWhitelist);

  // TODO: move this up to before some of the other attribute filters, or
  // explain why it should occur later
  filter_document_empty_attributes(document);
}

// Removes certain attributes from all elements in a document
// @param document {Document}
// @param whitelist {Object} each property is element name, each value is array
// of attribute names
function applyAttributeWhitelistFilter(document, whitelist) {
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
    filterElementAttributes(element, whitelist);
  }
}

function filterElementAttributes(element, whitelist) {
  // Use getAttributeNames over element.attributes because:
  // 1) Avoid complexity with changing attributes while iterating over
  // element.attributes
  // 2) Simpler use of for..of
  // 3) For the moment, appears to be faster than iterating element.attributes

  const attributeNames = element.getAttributeNames();
  if (attributeNames.length) {
    const whitelistedNames = whitelist[element.localName] || [];
    for (const attributeName of attributeNames) {
      if (!whitelistedNames.includes(attributeName)) {
        element.removeAttribute(attributeName);
      }
    }
  }
}

// Removes, moves, or otherwise changes certain out-of-place elements in
// document content
function applyAdoptionAgencyFilter(document) {
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

function filterBaseElements(document) {
  assert(document instanceof Document);
  const bases = document.querySelectorAll('base');
  for (const base of bases) {
    base.remove();
  }
}

function filterBRElements(document) {
  assert(document instanceof Document);
  if (document.body) {
    const brs = document.body.querySelectorAll('br + br');
    for (const br of brs) {
      br.remove();
    }
  }
}

function filterCommentNodes(document) {
  assert(document instanceof Document);
  const it = document.createNodeIterator(
      document.documentElement, NodeFilter.SHOW_COMMENT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

// Unwraps non-semantic container-like elements
function filterContainerElements(document) {
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
function filterEmphasis(document, maxTextLength) {
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
function filterFigureElements(document) {
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

function ensureDocumentHasBodyElement(document) {
  assert(document instanceof Document);
  if (!document.body) {
    const message = 'This document has no content (missing body).';
    const errorNode = document.createTextNode(message);
    const bodyElement = document.createElement('body');
    bodyElement.appendChild(errorNode);
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
      resolveSrcset(srcsetElement, base_url);
    }
  }
}

function resolveElementAttribute(element, base_url) {
  const attributeName = ELEMENT_ATTRIBUTE_MAP[element.localName];
  if (!attributeName) {
    return;
  }

  const originalURLString = element.getAttribute(attributeName);
  if (!originalURLString) {
    return;
  }

  const resolvedURL = resolveURLString(originalURLString, base_url);
  if (!resolvedURL) {
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
  // Also maybe store resolvedURL.href in a variable like canonicalURLString. It
  // mirrors the variable originalURLString better, and avoids the possible case
  // that Chrome doesn't do lazy-setter-call-memoization?

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

  if (resolvedURL.href.length !== originalURLString.length) {
    // TEMP: monitoring urls for above todo. This is going to spam but I think
    // I will probably focus on the todo rather soon.
    // console.debug('canonicalization change', originalURLString,
    //   resolvedURL.href);

    // NOTE: gathering some interesting messages
    // - if url is just '#' then it becomes just full link with # appended. I
    // probably should not be trying to canonical mailto at all.
    // - if url is mailto, it basically just encodes the url (e.g. spaces
    // escaped). Probably should just strip the #? Beware the bug i had last
    // time with google groups urls, a webserver can interpret # as ?
    // - https://play.freeciv.org https://play.freeciv.org/ . So yep, this is
    // exactly the concern, that i talked above above, all that
    // canonicalization accomplished was add a trailing slash.

    element.setAttribute(attributeName, resolvedURL.href);
  }
}

function resolveSrcset(element, base_url) {
  const srcsetAttributeValue = element.getAttribute('srcset');
  const descriptors = parse_srcset_wrapper(srcsetAttributeValue);

  let changeCount = 0;
  for (const descriptor of descriptors) {
    const resolvedURL = resolveURLString(descriptor.url, base_url);
    if (resolvedURL && resolvedURL.href.length !== descriptor.url.length) {
      descriptor.url = resolvedURL.href;
      changeCount++;
    }
  }

  if (changeCount) {
    const newValue = serializeSrcset(descriptors);
    if (newValue) {
      element.setAttribute('srcset', newValue);
    }
  }
}

// TODO: maybe inline
function resolveURLString(urlString, base_url) {
  assert(base_url instanceof URL);

  // Allow for bad input for caller convenience
  // If the url is not a string (e.g. undefined), return undefined
  if (typeof urlString !== 'string') {
    return;
  }

  // Check if urlString is just whitespace. If just whitespace, then return
  // undefined. This departs from the behavior of the URL constructor, which
  // tolerates an empty or whitespace string as input. The url constructor in
  // that case will create a new URL from the base url exclusively.
  // That is misleading for this purpose.

  // If the length of the string is 0 then return undefined
  if (!urlString) {
    return;
  }

  // If the trimmed length of the string is 0 then return undefined
  if (!urlString.trim()) {
    return;
  }

  let canonicalURL;
  try {
    canonicalURL = new URL(urlString, base_url);
  } catch (error) {
    // Ignore
  }
  return canonicalURL;
}


// @param descriptors {Array} an array of descriptors such as those produced
// by parseSrcset
// @returns {String} a string suitable for storing as srcset attribute value
function serializeSrcset(descriptors) {
  assert(Array.isArray(descriptors));

  const descriptorStrings = [];
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

    const descriptorString = strings.join('');
    descriptorStrings.push(descriptorString);
  }

  return descriptorStrings.join(', ');
}



// Changes the names of certain elements in document content
// TODO: take a look at the following article
// https://blog.usejournal.com/of-svg-minification-and-gzip-21cd26a5d007
// Look into how the html is stored in indexedDB, e.g. what compression, and
// then reconsider if this filter is more harmful than helpful.
// Use shorter names for common elements
// @param copyAttributesFlag {Boolean} optional, if true then copy attributes
// when renaming
function condense_tagnames(document, copyAttributesFlag) {
  assert(document instanceof Document);
  if (!document.body) {
    return;
  }

  element_coerce_all(document.body, 'strong', 'b', copyAttributesFlag);
  element_coerce_all(document.body, 'em', 'i', copyAttributesFlag);
}

const BLACKLISTED_ELEMENT_NAMES_SELECTOR = [
  'applet', 'audio',  'basefont', 'bgsound', 'command', 'datalist',
  'dialog', 'embed',  'head',     'isindex', 'link',    'math',
  'meta',   'object', 'output',   'param',   'path',    'progress',
  'spacer', 'style',  'svg',      'title',   'video',   'xmp'
].join(',');

// Filters blacklisted elements from document content
function filter_blacklisted_elements(document) {
  assert(document instanceof Document);
  const documentElement = document.documentElement;
  const elements =
      document.querySelectorAll(BLACKLISTED_ELEMENT_NAMES_SELECTOR);
  for (const element of elements) {
    if (documentElement.contains(element)) {
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
function filter_formatting_anchors(doc) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a');
  for (const anchor of anchors) {
    if (!anchor.hasAttribute('href')) {
      element_unwrap(anchor);
    }
  }
}


const FORMATTING_ELEMENT_NAMES_SELECTOR = [
  'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
  'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink', 'font',
  'plaintext', 'small', 'tt'
].join(',');

// Remove formatting elements
function filter_formatting_elements(document) {
  assert(document instanceof Document);
  if (document.body) {
    const elements =
        document.body.querySelectorAll(FORMATTING_ELEMENT_NAMES_SELECTOR);
    for (const element of elements) {
      element_unwrap(element);
    }
  }
}



// Removes frame content from a document
// @param doc {Document} the document to inspect and modify
function filter_frame_elements(doc) {
  assert(doc instanceof Document);

  // It is a bit counterintuitive but if a document is framed then the root
  // frame is its body, and doc.body points to it (and not some <body> element)

  let originalBody = doc.body;

  // If the document has no body or frame element, then there is nothing to do
  if (!originalBody) {
    return;
  }

  // If the body element is a body element and not a frame element, then there
  // is nothing to do
  if (originalBody.localName !== 'frameset') {
    return;
  }

  // The document is framed, transform into unframed
  let newBody = doc.createElement('body');

  // If available, move noframes content into the new body.
  const noframesElement = doc.querySelector('noframes');
  if (noframesElement) {
    for (let node = noframesElement.firstChild; node;
         node = noframesElement.firstChild) {
      newBody.appendChild(node);
    }
  }

  // If the new body is empty, add an error message about framed content
  if (!newBody.firstChild) {
    const errorNode = doc.createTextNode('Unable to display framed document');
    newBody.appendChild(errorNode);
  }

  // Replace the old frameset body with the new body
  // TODO: this assumes the body is always located under the doc element, I
  // think that is ok? Should maybe be stricter.
  doc.documentElement.replaceChild(newBody, originalBody);

  // Remove any frame or frameset elements if somehow any remain
  const frames = doc.querySelectorAll('frame, frameset');
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
function filter_hidden_elements(doc) {
  assert(doc instanceof Document);
  const body = doc.body;
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

// @param doc {Document}
// @param url {URL}
function filter_by_host_template(doc, url) {
  assert(doc instanceof Document);
  if (!url) {
    return;
  }

  // TODO: hostSelectorMap should be a parameter to this function so that
  // configuration is defined externally so that it can be changed without
  // needing to modify its internals (open-closed principle)

  const hostSelectorMap = {};
  hostSelectorMap['www.washingtonpost.com'] = [
    'header#wp-header', 'div.top-sharebar-wrapper',
    'div.newsletter-inline-unit', 'div.moat-trackable'
  ];
  hostSelectorMap['theweek.com'] = ['div#head-wrap'];
  hostSelectorMap['www.usnews.com'] = ['header.header'];

  const hostname = url.hostname;

  const selectors = hostSelectorMap[hostname];
  if (!selectors) {
    return;
  }

  console.log('hostTemplateFilter processing', url.href);

  const selector = selectors.join(',');
  const elements = doc.querySelectorAll(selector);
  for (const element of elements) {
    element.remove();
  }
}


// Filters certain horizontal rule elements from document content
// Look for all <hr><hr> sequences and remove the second one. Naive in that it
// does not fully account for new document state as hrs removed.
function filter_hr_elements(doc) {
  assert(doc instanceof Document);

  if (!doc.body) {
    return;
  }

  const hrs = doc.body.querySelectorAll('hr + hr');
  for (const hr of hrs) {
    hr.remove();
  }
}


// Filters iframe elements from document content
function filter_iframe_elements(doc) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  const iframes = doc.body.querySelectorAll('iframe');
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
async function applyImageSizeFilter(document, base_url, timeout) {
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
