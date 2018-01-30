import assert from '/src/common/assert.js';
import * as DOMUtils from '/src/common/dom-utils.js';

// TODO: this comment should be moved to github, labeled as bug
// TODO: not sure where it happens, but whatever removes BRs or certain
// whitespace, should not be removing BRs or line breaks that are descendants
// of <pre>. Or, if it does, it should be leaving behind a single space. Right
// now text nodes separated by BRs in a pre get merged.


// There are several content filters. I do not like the number of files.
// Therefore, I've created this module to aggregate together several of the
// filters that do not involve a large amount of code.

export function filterBaseElements(document) {
  assert(document instanceof Document);
  const bases = document.querySelectorAll('base');
  for (const base of bases) {
    base.remove();
  }
}

export function filterBRElements(document) {
  assert(document instanceof Document);
  if (document.body) {
    const brs = document.body.querySelectorAll('br + br');
    for (const br of brs) {
      br.remove();
    }
  }
}

export function filterCommentNodes(document) {
  assert(document instanceof Document);
  const it = document.createNodeIterator(
      document.documentElement, NodeFilter.SHOW_COMMENT);
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

// Unwraps non-semantic container-like elements
export function filterContainerElements(document) {
  assert(document instanceof Document);
  if (document.body) {
    const elements = document.body.querySelectorAll('div, ilayer, layer');
    for (const element of elements) {
      DOMUtils.unwrapElement(element);
    }
  }
}


// Unwraps emphasis elements that are longer than the given max length
// @param maxTextLength {Number} optional, integer >= 0,
export function filterEmphasis(document, maxTextLength) {
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
      DOMUtils.unwrapElement(element);
    }
  }
}

// Unwrap captionless figures
export function filterFigureElements(document) {
  assert(document instanceof Document);
  if (document.body) {
    const figures = document.body.querySelectorAll('figure');
    for (const figure of figures) {
      // We can tell a figure is captionless because a captioned element has
      // at least two elements.
      if (figure.childElementCount === 1) {
        // TODO: if the one child is a figcaption, then this should remove
        // the figure rather than unwrap
        DOMUtils.unwrapElement(figure);
      }
    }
  }
}

export function ensureDocumentHasBodyElement(document) {
  assert(document instanceof Document);
  if (!document.body) {
    const message = 'This document has no content (missing body).';
    const errorNode = document.createTextNode(message);
    const bodyElement = document.createElement('body');
    bodyElement.appendChild(errorNode);
    document.documentElement.appendChild(bodyElement);
  }
}
