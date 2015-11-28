// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: apply the blacklist filter after calamine instead of before
// maybe the blacklist filter should only flag elements instead
// of doing dom modification at first, and then do deferred manipulation?
// or maybe Calamine should be modified to include the blacklist filtering
// because it fits into original goal of boilerplate classification and 
// removal (instead of just identifying a best element)

function previewTransform(document) {
  'use strict';

  transformFrameElements(document);
  transformNoscripts(document);
  filterBlacklistedElements(document);
  Calamine.transform(document, false);
  filterComments(document);

  const hiddenExceptions = new Set(['noembed']);
  filterHiddenElements(document, hiddenExceptions, 0.3);

  filterTracerImages(document);

  replaceBreakRuleElements(document);
  normalizeWhitespace(document);
  trimTextNodes(document);
  transformScriptAnchors(document);
  unwrapInlineElements(document);
  
  const retainableAttributes = new Set(['href', 'src']);
  filterAttributes(document, retainableAttributes);

  LeafFilter$Transform(document);
  ListTransform.transform(document);
  trimDocument(document);
}

// Inspects a document for the presence of a frameset and lack of a body 
// element, and then removes the frameset and generates a body consisting 
// of either noframes content or an error message.
function transformFrameElements(document) {
  'use strict';

  let body = document.querySelector('body');
  const frameset = document.querySelector('frameset');
  if(!body && frameset) {
    const noframes = frameset.querySelector('noframes');
    body = document.createElement('body');
    if(noframes) {
      body.innerHTML = noframes.innerHTML;
    } else {
      body.textContent = 'Unable to display document due to frames.';
    }

    document.documentElement.appendChild(body);
    frameset.remove();
  }
}

// Due to content-loading tricks, noscript requires special handling
// e.g. nbcnews.com
// This requires some additional refinement. For now we just unwrap.
// This obviously leads to sometimes dup content or strange looking
// internal content
function transformNoscripts(document) {
  'use strict';
  const noscripts = document.querySelectorAll('noscript');
  const numNoscripts = noscripts.length;
  let noscript = null;
  for(let i = 0; i < numNoscripts; i++) {
    noscript = noscripts[i];
    // console.debug('Unwrapping noscript %s', noscript.outerHTML);
    DOMUtils.unwrap(noscript);
  }
}

// Removes all comments
// TODO: process IE conditional comments?
function filterComments(document) {
  'use strict';
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  let comment = it.nextNode();
  while(comment) {
    comment.remove();
    comment = it.nextNode();
  }
}

// Removes hidden elements
// @param exceptions {Set} a set of string names of elements never considered 
// hidden
// @param minOpacity {float} elements with a lesser opacity are considered 
// hidden
function filterHiddenElements(document, exceptions, minOpacity) {
  'use strict';

  minOpacity = minOpacity || 0.0;

  function acceptHidden(node) {

    if(exceptions.has(node.localName)) {
      return NodeFilter.FILTER_REJECT;
    }

    // This does not test against offsetWidth/Height because the 
    // properties do not appear to be initialized within inert documents
    // TODO: maybe try getting and using computed style?

    const style = node.style;
    // console.debug('Opacity: %s', style.opacity);
    const opacity = parseFloat(style.opacity);
    if(style.display === 'none' || style.visibility === 'hidden' || 
      style.visibility === 'collapse' || opacity <= minOpacity) {
      return NodeFilter.FILTER_ACCEPT;
    }

    return NodeFilter.FILTER_REJECT;
  }

  // Using NodeIterator avoids visiting detached subtrees
  const iterator = document.createNodeIterator(
    document.documentElement, NodeFilter.SHOW_ELEMENT, acceptHidden);
  let element = iterator.nextNode();
  while(element) {
    // console.debug('Removing %s', element.outerHTML);
    element.remove();
    element = iterator.nextNode();
  }
}

// Removes images that do not have a source url or that appear to be tracers. 
// A tracer image is a tracking technique where some websites embed a small, 
// hidden image into a document and then track the requests for that image 
// using a traditional web request log analytics tool. This function considers
// width and height independently, resulting in removal of images that appear
// like horizontal rule elements or vertical bars, which is also desired.
// NOTE: this assumes that images without explicit dimensions were pre-analyzed
// by DocumentUtils.setImageDimensions
function filterTracerImages(document) {
  'use strict';
  const images = document.querySelectorAll('img');
  const length = images.length;
  let image = null;
  let source = null;
  for(let i = 0; i < length; i++) {
    image = images[i];
    source = (image.getAttribute('src') || '').trim();

    if(!source || (image.width < 2) || (image.height < 2)) {
      // console.debug('Removing tracer %s', image.outerHTML);
      image.remove();
    }
  }
}

// TODO: improve this. br is allowed in inline elements
// and this is shoving non-inline p into inline sometimes
// so we need to be able to break the inline context in 
// half somehow
function replaceBreakRuleElements(document) {
  'use strict';
  const elements = document.querySelectorAll('br');
  const length = elements.length;
  for(let i = 0; i < length; i++) {
    const element = elements[i];
    const parent = element.parentElement;
    const p = document.createElement('p');
    parent.replaceChild(p, element);
  }
}

// TODO: what other whitespace transformations do we care about?
function normalizeWhitespace(document) {
  'use strict';
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  while(node) {
    node.nodeValue = node.nodeValue.replace(/&nbsp;/g, ' ');
    node = it.nextNode();
  }
}

function trimTextNodes(document) {
  'use strict';

  function isElement(node) {
    return node.nodeType === Node.ELEMENT_NODE;
  }

  const INLINE_ELEMENTS = new Set(['a','abbr', 'acronym', 'address',
    'b', 'bdi', 'bdo', 'blink','cite', 'code', 'data', 'del',
    'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'mark', 'map',
    'meter', 'q', 'rp', 'rt', 'samp', 'small', 'span', 'strike',
    'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var'
  ]);

  function isInlineElement(element) {
    return INLINE_ELEMENTS.has(element.localName);
  }

  const WHITESPACE_SENSITIVE_SELECTOR = 'code, code *, pre, pre *, ' + 
    'ruby, ruby *, xmp, xmp *';

  function rejectPreformatted(set, node) {
    return set.has(node.parentElement) ? 
      NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
  }

  // To avoid trimming nodes present within whitespace sensitive
  // elements, such as <pre>, we search for all such elements and 
  // elements within those elements, create a set of distinct 
  // elements, and use this to check if a given text node's parent
  // element falls within that set. Alternatively, we could walk 
  // up the dom each time, but this feels more performant.

  const elements = document.querySelectorAll(
    WHITESPACE_SENSITIVE_SELECTOR);
  const preformatted = new Set(Array.from(elements));
  const iterator = document.createNodeIterator(document.documentElement, 
    NodeFilter.SHOW_TEXT, rejectPreformatted.bind(this, preformatted));

  let node = iterator.nextNode();
  while(node) {
    if(node.previousSibling) {
      if(isElement(node.previousSibling)) {
        if(isInlineElement(node.previousSibling)) {
          if(node.nextSibling) {
            if(isElement(node.nextSibling)) {
              if(!isInlineElement(node.nextSibling)) {
                node.nodeValue = node.nodeValue.trimRight();
              }
            }
          } else {
            node.nodeValue = node.nodeValue.trimRight();
          }
        } else {
         node.nodeValue = node.nodeValue.trim();
        }
      } else {
       if(node.nextSibling) {
          if(isElement(node.nextSibling)) {
            if(isInlineElement(node.nextSibling)) {
            } else {
             node.nodeValue = node.nodeValue.trimRight();
            }
          }
        } else {
          node.nodeValue = node.nodeValue.trimRight();
        }
      }
    } else if(node.nextSibling) {
     if(isElement(node.nextSibling)) {
        if(isInlineElement(node.nextSibling)) {
          node.nodeValue = node.nodeValue.trimLeft();
        } else {
          node.nodeValue = node.nodeValue.trim();
        }
      } else {
        node.nodeValue = node.nodeValue.trimLeft();
      }
    } else {
      node.nodeValue = node.nodeValue.trim();
    }

    if(!node.nodeValue) {
      node.remove();
    }

    node = iterator.nextNode();
  }
}

function transformScriptAnchors(document) {
  'use strict';
  const anchors = document.querySelectorAll('a');
  const numAnchors = anchors.length;
  let anchor = null;
  let href = null;
  for(let i = 0; i < numAnchors; i++) {
    anchor = anchors[i];
    href = anchor.getAttribute('href');
    href = (href || '').trim();

    // If it is a script anchor, set href to empty
    // so that the anchor will be unwrapped
    if(/^\s*javascript\s*:/i.test(href)) {
      // console.debug('Javascript anchor %o', anchor);
      href = null;
    }

    // We do not care about other methods of scripting
    // like onclick attribute, those attributes are removed

    if(!href) {
      //console.debug('Unwrapping anchor %o', anchor);
      DOMUtils.unwrap(anchor);
    }
  }
}

function unwrapInlineElements(document) {
  'use strict';
  // NOTE: NodeIterator does not react properly to unwrap
  // NOTE: This does not contain ALL inline elements, just those we 
  // want to unwrap.
  // anchors are handled separately
  // fallback elements (e.g. noscript) are handled separately
  const INLINE_ELEMENTS = new Set([
    'article',
    'big',
    'blink',
    'center',
    'colgroup',
    'data', 
    'details',
    'div',
    'font',
    'footer',
    'form',
    'header',
    'help',
    'hgroup',
    'ilayer',
    'insert',
    'label',
    'layer',
    'legend',
    'main',
    'mark',
    'marquee',
    'meter',
    'multicol',
    'nobr',
    'noembed',
    'plaintext',
    'section',
    'small',
    'span',
    'tbody',
    'tfoot', 
    'thead',
    'tt'
  ]);

  const selector = Array.from(INLINE_ELEMENTS).join(',');
  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;
  let element = null;
  for(let i = 0; i < numElements; i++) {
    element = elements[i];
    // console.debug('Unwrapping %o', element);
    DOMUtils.unwrap(element);
  }
}

function trimDocument(document) {
  'use strict';

  function isTrimmable(element) {
    if(!element) return false;
    if(element.nodeType !== Node.ELEMENT_NODE) return false;
    let name = element.localName;
    if(name === 'br') return true;
    if(name === 'hr') return true;
    if(name === 'p' && !element.firstChild) return true;
    return false;
  }

  const root = document.body;

  if(!root) {
    return;
  }

  let sibling = root;
  let node = root.firstChild;
  while(isTrimmable(node)) {
    sibling = node.nextSibling;
    node.remove();
    node = sibling;
  }

  node = root.lastChild;
  while(isTrimmable(node)) {
    sibling = node.previousSibling;
    node.remove();
    node = sibling;
  }
}
