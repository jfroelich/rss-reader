import * as boilerplate from '/lib/boilerplate.js';
import * as imageUtils from '/lib/image-utils.js';
import * as srcsetUtils from '/lib/srcset-utils.js';
import { isHiddenElement } from '/lib/is-hidden-inline.js';
import assert from '/lib/assert.js';
import coerceElement from '/lib/coerce-element.js';
import colorContrastFilter from '/lib/dom-filters/color-contrast.js';
import nodeIsLeaf from '/lib/node-is-leaf.js';
import removeEmptyAttributes from '/lib/dom-filters/remove-empty-attributes.js';
import removeFrames from '/lib/dom-filters/framset.js';
import removeOverEmphasis from '/lib/dom-filters/over-emphasis.js';
import removeTelemetryElements from '/lib/dom-filters/lonestar-filter.js';
import removeUnreachableImageElements from '/lib/dom-filters/remove-unreachable-image-elements.js';
import setAllImageElementDimensions from '/lib/dom-filters/set-all-image-element-dimensions.js';
import transformLazilyLoadedImageElements from '/lib/dom-filters/lazily-loaded-images.js';
import transformResponsiveImageElements from '/lib/dom-filters/responsive-images.js';
import unwrapElement from '/lib/unwrap-element.js';
import unwrapSingleItemListElements from '/lib/dom-filters/single-item-lists.js';

// Applies several content filters to a document. The filters are applied in a
// logical order that tries to minimize the amount of work done, and to preserve
// correctness.
export async function applyAllDOMFilters(doc, options = {}) {
  assert(doc instanceof Document);
  assert(typeof options === 'object');

  removeFrames(doc, options.emptyFrameBodyMessage);
  ensureBodyElement(doc);
  removeIframeElements(doc);
  removeCommentNodes(doc);
  removeHiddenElements(doc, options.contrastMatte, options.contrastRatio);

  const forbiddenElementNames = [
    'applet', 'audio', 'basefont', 'bgsound', 'command', 'datalist',
    'dialog', 'embed', 'isindex', 'link', 'math', 'meta',
    'object', 'output', 'param', 'path', 'progress', 'spacer',
    'svg', 'title', 'video', 'xmp'
  ];
  removeForbiddenElements(doc, forbiddenElementNames);

  removeScriptElements(doc);
  transformLazilyLoadedImageElements(doc);
  resolveAllElementAttributeURLs(doc);
  transformResponsiveImageElements(doc);
  removeTelemetryElements(doc);
  removeSourcelessImageElements(doc);
  await removeUnreachableImageElements(doc, options.reachableImageFilterTimeout);
  await setAllImageElementDimensions(doc, options.imageDimensionsFilterTimeout);
  removeBoilerplateContent(doc);
  unwrapAnchorElementsWithScriptURLs(doc);
  removeImageElementsByDimensions(doc);
  condenseTagnamesFilter(doc);
  unwrapFormattingAnchorElements(doc);
  removeFormElements(doc);
  transformBreakruleElements(doc);
  transformHorizontalRuleElements(doc);
  unwrapFormattingElements(doc);
  removeMisnestedElements(doc);
  removeSemanticElements(doc);
  unwrapFigureElements(doc);
  unwrapContainerElements(doc);
  unwrapSingleItemListElements(doc);
  unwrapSingleColumnTableElements(doc, options.tableScanMaxRows);
  removeOverEmphasis(doc, options.emphasisMaxLength);
  condenseNodeWhitespace(doc);
  removeLeafNodes(doc);
  trimDocument(doc);
  const allowedAttributes = {
    a: ['href', 'name', 'title', 'rel'],
    iframe: ['src'],
    source: ['media', 'sizes', 'srcset', 'src', 'type'],
    img: ['src', 'alt', 'title', 'srcset', 'width', 'height']
  };
  removeForbiddenAttributeNames(doc, allowedAttributes);
  removeEmptyAttributes(doc);
  removeStyleElements(doc);
  removeBaseElements(doc);
}

export function unwrapFormattingAnchorElements(doc) {
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
export function unwrapAnchorElementsWithScriptURLs(doc) {
  const anchors = doc.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    // eslint-disable-next-line no-script-url
    if (anchor.protocol === 'javascript:') {
      unwrapElement(anchor);
    }
  }
}

// Removes certain attributes from all elements in a document. |allowedAttributes| is
// an object map where each key is element name and each value is array of
// names of retainable attributes.
export function removeForbiddenAttributeNames(doc, allowedAttributes) {
  assert(typeof allowedAttributes === 'object');
  const elements = doc.getElementsByTagName('*');
  for (const element of elements) {
    const names = element.getAttributeNames();
    if (names.length) {
      const goodNames = allowedAttributes[element.localName] || [];
      for (const name of names) {
        if (!goodNames.includes(name)) {
          element.removeAttribute(name);
        }
      }
    }
  }
}

export function removeBaseElements(doc) {
  for (const base of doc.querySelectorAll('base')) {
    base.remove();
  }
}

// |blacklist| is an array of element names.
export function removeForbiddenElements(doc, blacklist) {
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

function ensureBodyElement(doc) {
  if (!doc.body) {
    const message = 'This document has no content';
    const errorNode = doc.createTextNode(message);
    const bodyElement = doc.createElement('body');
    bodyElement.append(errorNode);
    doc.documentElement.append(bodyElement);
  }
}

export function removeBoilerplateContent(doc, options = {}) {
  let dataset = boilerplate.parseBlocks(doc, boilerplate.neutralScore);
  assert(dataset);
  dataset = boilerplate.extractFeatures(dataset, options);
  assert(dataset);
  dataset = boilerplate.classify(dataset, boilerplate.scoreBlock);
  assert(dataset);
  for (const row of dataset) {
    if (row.score < boilerplate.neutralScore) {
      const element = boilerplate.findBlockElement(doc, row);
      assert(element);
      element.remove();
    }
  }
}

export function transformBreakruleElements(doc) {
  const subsequentBrs = doc.querySelectorAll('br + br');
  for (const br of subsequentBrs) {
    br.remove();
  }
}

// Removes all HTML comment nodes from the document
export function removeCommentNodes(doc) {
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
    { before: 'layer', after: 'div' }
  ];
  for (const rename of renames) {
    const elements = doc.querySelectorAll(rename.before);
    for (const element of elements) {
      coerceElement(element, rename.after);
    }
  }
}

// Removes container-like elements from the doc
export function unwrapContainerElements(doc) {
  const elements = doc.querySelectorAll('div, ilayer, layer');
  for (const element of elements) {
    unwrapElement(element);
  }
}


export function unwrapFigureElements(doc) {
  for (const figure of doc.querySelectorAll('figure')) {
    const childCount = figure.childElementCount;
    if (childCount === 1) {
      if (figure.firstElementChild.localName === 'figcaption') {
        // caption without an image, remove it all
        figure.remove();
      } else {
        unwrapElement(figure);
      }
    } else if (childCount === 0) {
      unwrapElement(figure);
    }
  }
}

export function removeFormElements(doc) {
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

export function unwrapFormattingElements(doc) {
  const selector = [
    'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend', 'mark', 'marquee',
    'meter', 'nobr', 'span', 'big', 'blink', 'font', 'plaintext', 'small', 'tt'
  ].join(',');
  const elements = doc.querySelectorAll(selector);
  for (const element of elements) {
    unwrapElement(element);
  }
}


// Filters certain horizontal rule elements from document content
// Look for all <hr><hr> sequences and remove the second one. Naive in that it
// does not fully account for new document state as hrs removed.
export function transformHorizontalRuleElements(doc) {
  if (doc.body) {
    const hrs = doc.body.querySelectorAll('hr + hr');
    for (const hr of hrs) {
      hr.remove();
    }
  }
}

export function removeIframeElements(doc) {
  const frames = doc.querySelectorAll('iframe');
  for (const frame of frames) {
    frame.remove();
  }
}

// Removes dead images from the document (e.g. no detectable associated url)
export function removeSourcelessImageElements(doc) {
  for (const image of doc.querySelectorAll('img')) {
    if (!imageUtils.imageHasSource(image)) {
      imageUtils.removeImage(image);
    }
  }
}


// Remove or modify images based on size. Assumes images have dimensions.
export function removeImageElementsByDimensions(doc) {
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
      imageUtils.removeImage(image);
    }
  }
}


// Searches the document for misnested elements and tries to fix each
// occurrence.
export function removeMisnestedElements(doc) {
  const hrsWithinLists = doc.querySelectorAll('ul > hr, ol > hr, dl > hr');
  for (const hr of hrsWithinLists) {
    hr.remove();
  }

  const nestedAnchors = doc.querySelectorAll('a a');
  for (const descendantAnchor of nestedAnchors) {
    unwrapElement(descendantAnchor);
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

export function removeLeafNodes(doc) {
  const root = doc.documentElement;
  const elements = doc.querySelectorAll('*');
  for (const element of elements) {
    if (root.contains(element) && nodeIsLeaf(element)) {
      element.remove();
    }
  }
}

// Filters certain whitespace from node values
export function condenseNodeWhitespace(doc) {
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

export function removeScriptElements(doc) {
  const elements = doc.querySelectorAll('noscript, script');
  for (const element of elements) {
    element.remove();
  }
}

export function removeSemanticElements(doc) {
  const selector = 'article, aside, footer, header, main, section';
  const elements = doc.querySelectorAll(selector);
  for (const element of elements) {
    unwrapElement(element);
  }
}

// Filters certain table elements from document content
export function unwrapSingleColumnTableElements(doc, rowScanMax) {
  const elements = doc.querySelectorAll('colgroup, hgroup, multicol, tbody, tfoot, thead');
  for (const element of elements) {
    unwrapElement(element);
  }

  const tables = doc.querySelectorAll('table');
  for (const table of tables) {
    const { rows } = table;
    const limit = Math.min(rows.length, rowScanMax);
    let isSingleColumn = true;
    for (let i = 0; i < limit && isSingleColumn; i += 1) {
      const { cells } = rows[i];
      let filled = 0;
      for (let j = 0; j < cells.length; j += 1) {
        if (!nodeIsLeaf(cells[j])) {
          filled += 1;
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

export function trimDocument(doc) {
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
    return node.nodeType === Node.TEXT_NODE ?
      !node.nodeValue.trim() :
      ['br', 'hr', 'nobr'].includes(node.localName);
  }
}

// Remove style elements.
export function removeStyleElements(doc) {
  const styles = doc.querySelectorAll('style');
  for (const style of styles) {
    style.remove();
  }
}

// Resolves all element attribute values that contain urls in |document|.
// Assumes the document has a valid base uri.
export function resolveAllElementAttributeURLs(doc) {
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
    video: 'src'
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
          changeCount += 1;
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

export function removeHiddenElements(doc, matte, mcr) {
  const elements = doc.querySelectorAll('*');
  for (const element of elements) {
    if (doc.documentElement.contains(element) && isHiddenElement(element)) {
      unwrapElement(element);
    }
  }

  colorContrastFilter(doc, matte, mcr);
}


function condenseWhitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}
