import assert from '/lib/assert.js';
import coerceElement from '/lib/coerce-element.js';
import * as boilerplate from '/lib/boilerplate.js';
import colorContrastFilter from '/lib/dom-filters/color-contrast-filter.js';
import { imageDimensionsFilter } from '/lib/dom-filters/image-dimensions-filter.js';
import imageReachableFilter from '/lib/dom-filters/image-reachable-filter.js';
import { lonestarFilter } from '/lib/dom-filters/lonestar-filter.js';
import * as imageUtils from '/lib/image-utils.js';
import { isHiddenElement } from '/lib/is-hidden-inline.js';
import nodeIsLeaf from '/lib/node-is-leaf.js';
import * as srcsetUtils from '/lib/srcset-utils.js';
import unwrapElement from '/lib/unwrap-element.js';

// Applies several content filters to a document. The filters are applied in a
// logical order that tries to minimize the amount of work done, and to preserve
// correctness.
export async function compositeDocumentFilter(doc, options = {}) {
  assert(doc instanceof Document);
  assert(typeof options === 'object');

  frameFilter(doc, options.empty_frame_body_message);
  ensureBodyElementFilter(doc);
  iframeFilter(doc);
  commentFilter(doc);
  visibilityFilter(doc, options.contrast_matte, options.contrast_ratio);

  const forbiddenElementNames = [
    'applet', 'audio', 'basefont', 'bgsound', 'command', 'datalist',
    'dialog', 'embed', 'isindex', 'link', 'math', 'meta',
    'object', 'output', 'param', 'path', 'progress', 'spacer',
    'svg', 'title', 'video', 'xmp',
  ];
  blacklistFilter(doc, forbiddenElementNames);

  scriptFilter(doc);
  imageLazyFilter(doc);
  urlResolveFilter(doc);
  imageResponsiveFilter(doc);
  lonestarFilter(doc);
  imageDeadFilter(doc);
  await imageReachableFilter(doc, options.image_size_timeout);
  await imageDimensionsFilter(doc, options.image_size_timeout);
  boilerplateFilter(doc);
  anchorScriptFilter(doc);
  imageSizeConstrainFilter(doc);
  condenseTagnamesFilter(doc);
  anchorFormatFilter(doc);
  formFilter(doc);
  breakruleFilter(doc);
  horizontalRuleFilter(doc);
  formatFilter(doc);
  nestFilter(doc);
  semanticFilter(doc);
  figureFilter(doc);
  containerFilter(doc);
  listFilter(doc);
  tableFilter(doc, options.table_scan_max_rows);
  emphasisFilter(doc, options.emphasis_max_length);
  nodeWhitespaceFilter(doc);
  nodeLeafFilter(doc);
  documentTrimFilter(doc);
  const allowedAttributes = {
    a: ['href', 'name', 'title', 'rel'],
    iframe: ['src'],
    source: ['media', 'sizes', 'srcset', 'src', 'type'],
    img: ['src', 'alt', 'title', 'srcset', 'width', 'height'],
  };
  attributeUnknownFilter(doc, allowedAttributes);
  attributeEmptyFilter(doc);
  styleFilter(doc);
  baseFilter(doc);
}

export function anchorFormatFilter(doc) {
  const anchors = doc.querySelectorAll('a');
  for (const anchor of anchors) {
    if (!anchor.hasAttribute('href')) {
      unwrapElement(anchor);
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
export function anchorScriptFilter(doc) {
  const anchors = doc.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    if (anchor.protocol === 'javascript:') {
      unwrapElement(anchor);
    }
  }
}

export function attributeEmptyFilter(doc) {
  // Adapted from https://github.com/kangax/html-minifier/issues/63
  const booleanAttributeNames = [
    'allowfullscreen', 'async', 'autofocus', 'autoplay',
    'checked', 'compact', 'controls', 'declare',
    'default', 'defaultchecked', 'defaultmuted', 'defaultselected',
    'defer', 'disabled', 'draggable', 'enabled',
    'formnovalidate', 'hidden', 'indeterminate', 'inert',
    'ismap', 'itemscope', 'loop', 'multiple',
    'muted', 'nohref', 'noresize', 'noshade',
    'novalidate', 'nowrap', 'open', 'pauseonexit',
    'readonly', 'required', 'reversed', 'scoped',
    'seamless', 'selected', 'sortable', 'spellcheck',
    'translate', 'truespeed', 'typemustmatch', 'visible',
  ];

  const elements = doc.querySelectorAll('*');
  for (const element of elements) {
    const names = element.getAttributeNames();
    for (const name of names) {
      if (!booleanAttributeNames.includes(name)) {
        const value = element.getAttribute(name);
        if (!value || !value.trim()) {
          element.removeAttribute(name);
        }
      }
    }
  }
}

// Removes certain attributes from all elements in a document. |allowedAttributes| is
// an object map where each key is element name and each value is array of
// names of retainable attributes.
export function attributeUnknownFilter(doc, allowedAttributes) {
  assert(typeof allowedAttributes === 'object');
  const elements = doc.getElementsByTagName('*');
  for (const element of elements) {
    const names = element.getAttributeNames();
    if (names.length) {
      const good_names = allowedAttributes[element.localName] || [];
      for (const name of names) {
        if (!good_names.includes(name)) {
          element.removeAttribute(name);
        }
      }
    }
  }
}

export function baseFilter(doc) {
  for (const base of doc.querySelectorAll('base')) {
    base.remove();
  }
}

// |blacklist| is an array of element names.
export function blacklistFilter(doc, blacklist) {
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

function ensureBodyElementFilter(doc) {
  if (!doc.body) {
    const message = 'This document has no content';
    const errorNode = doc.createTextNode(message);
    const bodyElement = doc.createElement('body');
    bodyElement.append(errorNode);
    doc.documentElement.append(bodyElement);
  }
}

export function boilerplateFilter(doc, options = {}) {
  let dataset = boilerplate.parse_blocks(doc, boilerplate.neutralScore);
  assert(dataset);
  dataset = boilerplate.extract_features(dataset, options);
  assert(dataset);
  dataset = boilerplate.classify(dataset, boilerplate.score_block);
  assert(dataset);
  for (const row of dataset) {
    if (row.score < boilerplate.neutralScore) {
      const element = boilerplate.find_block_element(doc, row);
      assert(element);
      element.remove();
    }
  }
}

export function breakruleFilter(doc) {
  const subsequentBrs = doc.querySelectorAll('br + br');
  for (const br of subsequentBrs) {
    br.remove();
  }
}

// Removes all HTML comment nodes from the document
export function commentFilter(doc) {
  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_COMMENT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

// Replaces certain elements in |doc| with equivalents that use fewer
// characters in the element name, so that when a document it serialized, it
// contains fewer characters.
export function condenseTagnamesFilter(doc) {
  const renames = [
    { before: 'strong', after: 'b' }, { before: 'em', after: 'i' },
    { before: 'layer', after: 'div' },
  ];
  for (const rename of renames) {
    const elements = doc.querySelectorAll(rename.before);
    for (const element of elements) {
      coerceElement(element, rename.after);
    }
  }
}

// Removes container-like elements from the doc
export function containerFilter(doc) {
  const elements = doc.querySelectorAll('div, ilayer, layer');
  for (const element of elements) {
    unwrapElement(element);
  }
}

// Filters out emphasis-related elements that are too long. |threshold| is an
// optional cutoff for determining whether an element is over-emphasized, where
// length is whitespace-adjusted.
export function emphasisFilter(doc, threshold = 0) {
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
    'strong strong, strong b, b strong, b b, u u, u em, em u, em em',
  );
  for (const element of redundants) {
    unwrapElement(element);
  }

  if (threshold > 0) {
    const selector = 'b, big, em, i, strong, mark, u';
    const elements = doc.querySelectorAll(selector);
    for (const element of elements) {
      if (element.textContent.replace(/\s+/, '').length > threshold) {
        unwrapElement(element);
      }
    }
  }
}

export function figureFilter(doc) {
  for (const figure of doc.querySelectorAll('figure')) {
    const child_count = figure.childElementCount;
    if (child_count === 1) {
      if (figure.firstElementChild.localName === 'figcaption') {
        // caption without an image, remove it all
        figure.remove();
      } else {
        unwrapElement(figure);
      }
    } else if (child_count === 0) {
      unwrapElement(figure);
    }
  }
}

export function formFilter(doc) {
  const selector = 'button, fieldset, input, optgroup, option, select, textarea';
  const elements = doc.querySelectorAll(selector);
  for (const element of elements) {
    if (doc.documentElement.contains(element)) {
      element.remove();
    }
  }

  for (const label of doc.querySelectorAll('label')) {
    unwrapElement(label);
  }

  for (const form of doc.querySelectorAll('form')) {
    unwrapElement(form);
  }
}

export function formatFilter(doc) {
  const selector = [
    'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
    'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink', 'font',
    'plaintext', 'small', 'tt',
  ].join(',');
  const elements = doc.querySelectorAll(selector);
  for (const element of elements) {
    unwrapElement(element);
  }
}

// Removes frame-related content from a document, including frameset, frame, and
// noframes, but excluding iframes. The |defaultMessage| is displayed when this
// filter results in producing an otherwise empty body element.
export function frameFilter(doc, defaultMessage = 'Framed content not supported') {
  const framesetElement = doc.querySelector('frameset');
  if (!framesetElement) {
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
  let bodyElement = doc.querySelectorAll('body');
  if (bodyElement) {
    // There is both a frameset and a body, which is malformed html. Keep the
    // body and pitch the frameset.
    framesetElement.remove();

    // If a body element existed in addition to the frameset element, clear it
    // out. This is malformed html.
    let child = bodyElement.firstChild;
    while (child) {
      bodyElement.removeChild(child);
      child = bodyElement.firstChild;
    }
  } else {
    // Removing the frameset will leave the document without a body. Since we
    // have a frameset and no body, create a new body element in place of the
    // frameset. This will detach the existing frameset. This assumes there is
    // only one frameset.
    bodyElement = doc.createElement('body');

    const newChild = bodyElement;
    const oldChild = framesetElement;
    doc.documentElement.replaceChild(newChild, oldChild);
  }

  // noframes, if present, should be nested within frameset in well-formed html.
  // Now look for noframes elements within the detached frameset, and if found,
  // move their contents into the body element. I am not sure if there should
  // only be one noframes element or multiple are allowed, so just look for all.
  const noframesElements = framesetElement.querySelectorAll('noframes');
  for (const e of noframesElements) {
    for (let node = e.firstChild; node; node = e.firstChild) {
      bodyElement.append(node);
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
  if (!bodyElement.firstChild) {
    bodyElement.append(defaultMessage);
  }
}

// Filters certain horizontal rule elements from document content
// Look for all <hr><hr> sequences and remove the second one. Naive in that it
// does not fully account for new document state as hrs removed.
export function horizontalRuleFilter(doc) {
  if (doc.body) {
    const hrs = doc.body.querySelectorAll('hr + hr');
    for (const hr of hrs) {
      hr.remove();
    }
  }
}

export function iframeFilter(doc) {
  const frames = doc.querySelectorAll('iframe');
  for (const frame of frames) {
    frame.remove();
  }
}

// Removes dead images from the document (e.g. no detectable associated url)
export function imageDeadFilter(doc) {
  for (const image of doc.querySelectorAll('img')) {
    if (!imageUtils.imageHasSource(image)) {
      imageUtils.removeImage(image);
    }
  }
}

// This should occur before canonicalizing urls, because it may set attributes
// that need to be canonicalized that previously did not exist, and would be
// missed by the urlResolveFilter filter. This was previously a bug.
export function imageLazyFilter(doc) {
  const lazyAttributeNames = [
    'big-src', 'load-src', 'data-src', 'data-src-full16x9', 'data-src-large',
    'data-original-desktop', 'data-baseurl', 'data-flickity-lazyload',
    'data-lazy', 'data-path', 'data-image-src', 'data-original',
    'data-adaptive-image', 'data-imgsrc', 'data-default-src', 'data-hi-res-src',
  ];

  const images = doc.querySelectorAll('img');
  for (const image of images) {
    if (!imageUtils.imageHasSource(image)) {
      const attr_names = image.getAttributeNames();
      for (const name of lazyAttributeNames) {
        if (attr_names.includes(name)) {
          const value = image.getAttribute(name);
          if (isValidURLString(value)) {
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
export function imageResponsiveFilter(doc) {
  const selector = 'img[srcset]:not([src])';
  const images = doc.querySelectorAll(selector);
  for (const image of images) {
    const descriptors = srcsetUtils.parse(image.getAttribute('srcset'));
    let chosenDescriptor = null;
    for (const desc of descriptors) {
      if (desc.url) {
        if (desc.w || desc.h) {
          chosenDescriptor = desc;
          break;
        } else if (!chosenDescriptor) {
          chosenDescriptor = desc; // continue searching
        }
      }
    }

    if (chosenDescriptor) {
      image.removeAttribute('srcset');
      image.removeAttribute('width');
      image.removeAttribute('height');

      image.setAttribute('src', chosenDescriptor.url);
      if (chosenDescriptor.w) {
        image.setAttribute('width', `${chosenDescriptor.w}`);
      }
      if (chosenDescriptor.h) {
        image.setAttribute('height', `${chosenDescriptor.h}`);
      }
    }
  }
}


// Remove or modify images based on size. Assumes images have dimensions.
export function imageSizeConstrainFilter(doc) {
  const images = doc.querySelectorAll('img');
  for (const image of images) {
    // For large images, remove explicit dimensions to allow for natural
    // dimension precedence and avoid scaling issues in the UI
    if (image.width > 1024 || image.height > 1024) {
      image.removeAttribute('width');
      image.removeAttribute('height');
    } else if (
      image.width > 2 && image.width < 33 && image.height > 2
        && image.height < 33) {
      // Remove small images because we assume those images are probably
      // boilerplate, part of a site's template, or telemetry.
      imageUtils.removeImage(image);
    }
  }
}

// Remove empty/single-item lists
export function listFilter(doc) {
  assert(typeof doc.baseURI === 'string');
  assert(
    !doc.baseURI.startsWith('chrome-extension:'),
    `bad baseURI somehow ${doc.baseURI}`,
  );

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

    unwrapElement(list);
  }
}

// Searches the document for misnested elements and tries to fix each
// occurrence.
export function nestFilter(doc) {
  const hrsWithinLists = doc.querySelectorAll('ul > hr, ol > hr, dl > hr');
  for (const hr of hrsWithinLists) {
    hr.remove();
  }

  const nestedAnchors = doc.querySelectorAll('a a');
  for (const descendant_anchor of nestedAnchors) {
    unwrapElement(descendant_anchor);
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
  const blockSelector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inlineSelector = 'a, span, b, strong, i';

  const blocks = doc.querySelectorAll(blockSelector);
  for (const block of blocks) {
    const ancestor = block.closest(inlineSelector);
    if (ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for (let node = block.firstChild; node; node = block.firstChild) {
        ancestor.append(node);
      }
      block.append(ancestor);
    }
  }
}

export function nodeLeafFilter(doc) {
  const root = doc.documentElement;
  const elements = doc.querySelectorAll('*');
  for (const element of elements) {
    if (root.contains(element) && nodeIsLeaf(element)) {
      element.remove();
    }
  }
}

// Filters certain whitespace from node values
export function nodeWhitespaceFilter(doc) {
  const whitespaceSensitiveElementSelector = 'code, pre, ruby, script, style, textarea, xmp';
  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const val = node.nodeValue;
    if (val.length > 3 && !node.parentNode.closest(whitespaceSensitiveElementSelector)) {
      const newValue = condenseWhitespace(val);
      if (newValue.length !== val.length) {
        node.nodeValue = newValue;
      }
    }
  }
}

export function scriptFilter(doc) {
  const elements = doc.querySelectorAll('noscript, script');
  for (const element of elements) {
    element.remove();
  }
}

export function semanticFilter(doc) {
  const selector = 'article, aside, footer, header, main, section';
  const elements = doc.querySelectorAll(selector);
  for (const element of elements) {
    unwrapElement(element);
  }
}

// Filters certain table elements from document content
export function tableFilter(doc, rowScanMax) {
  const elements = doc.querySelectorAll('colgroup, hgroup, multicol, tbody, tfoot, thead');
  for (const element of elements) {
    unwrapElement(element);
  }

  const tables = doc.querySelectorAll('table');
  for (const table of tables) {
    const { rows } = table;
    const limit = Math.min(rows.length, rowScanMax);
    let isSingleColumn = true;
    for (let i = 0; i < limit && isSingleColumn; i++) {
      const { cells } = rows[i];
      let filled = 0;
      for (let j = 0; j < cells.length; j++) {
        if (!nodeIsLeaf(cells[j])) {
          filled++;
          if (filled > 1) {
            isSingleColumn = false;
            break;
          }
        }
      }
    }

    if (isSingleColumn) {
      unwrapElement(table);
    }
  }
}

export function documentTrimFilter(doc) {
  if (doc.body) {
    const { firstChild } = doc.body;
    if (firstChild) {
      trimFilterStep(firstChild, 'nextSibling');
      const { lastChild } = doc.body;
      if (lastChild && lastChild !== firstChild) {
        trimFilterStep(lastChild, 'previousSibling');
      }
    }
  }

  function trimFilterStep(startNode, edgeName) {
    let node = startNode;
    while (node && nodeIsTrimmable(node)) {
      const sibling = node[edgeName];
      node.remove();
      node = sibling;
    }
  }

  function nodeIsTrimmable(node) {
    return node.nodeType === Node.TEXT_NODE
      ? !node.nodeValue.trim()
      : ['br', 'hr', 'nobr'].includes(node.localName);
  }
}

// Remove style elements.
export function styleFilter(doc) {
  const styles = doc.querySelectorAll('style');
  for (const style of styles) {
    style.remove();
  }
}

// Resolves all element attribute values that contain urls in |document|.
// Assumes the document has a valid base uri.
export function urlResolveFilter(doc) {
  const baseURL = new URL(doc.baseURI);
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
    video: 'src',
  };

  // In the first pass, select all mapped elements present anywhere in the
  // document, and resolve attribute values per element
  const selector = Object.keys(map).map(key => `${key}[${map[key]}]`).join(',');
  const elements = doc.querySelectorAll(selector);

  for (const element of elements) {
    const attributeName = map[element.localName];
    if (attributeName) {
      const attributeValue = element.getAttribute(attributeName);
      if (attributeValue) {
        try {
          const url = new URL(attributeValue, baseURL);
          if (url.href !== attributeValue) {
            element.setAttribute(attributeName, url.href);
          }
        } catch (error) {
          // Ignore
        }
      }
    }
  }

  // TODO: also do this in the first pass somehow, e.g. store * as value in
  // map and that means it is special handling

  const srcsetSelector = 'img[srcset], source[srcset]';
  const srcsetElements = doc.querySelectorAll(srcsetSelector);
  for (const element of srcsetElements) {
    const descriptors = srcsetUtils.parse(element.getAttribute('srcset'));

    let changeCount = 0;
    for (const desc of descriptors) {
      try {
        const url = new URL(desc.url, baseURL);
        if (url.href.length !== desc.url.length) {
          desc.url = url.href;
          changeCount++;
        }
      } catch (error) {
        // Ignore
      }
    }

    if (changeCount) {
      const newValue = srcsetUtils.serialize(descriptors);
      if (newValue) {
        element.setAttribute('srcset', newValue);
      }
    }
  }
}

export function visibilityFilter(doc, matte, mcr) {
  const elements = doc.querySelectorAll('*');
  for (const element of elements) {
    if (doc.documentElement.contains(element) && isHiddenElement(element)) {
      unwrapElement(element);
    }
  }

  colorContrastFilter(doc, matte, mcr);
}

// Very minimally validate a url string. Exported for testing
export function isValidURLString(value) {
  return typeof value === 'string' && value.length > 1
      && value.length <= 3000 && !value.trim().includes(' ');
}

function condenseWhitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}
