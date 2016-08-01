// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Routines for cleaning up nodes in an HTMLDocument
const DOMAid = Object.create(null);

// Applies a series of filters to a document. Modifies the document
// in place. The filters are applied in a preset order so as to minimize the
// work done by each sequential step, and to ensure proper handling of
// things like frameset elements.
DOMAid.cleanDocument = function(document) {
  filterCommentNodes(document);
  DOMAid.filterFrameElements(document);
  DOMAid.filterNoscriptElements(document);
  filterBlacklistedElements(document);
  filterHiddenElements(document);
  adjustBlockWithinInlineElements(document);
  filterBRElements(document);
  filterAnchorElements(document);
  filterImageElements(document);
  filterUnwrappableElements(document);
  DOMAid.filterFigureElements(document);
  DOMAid.filterHairSpaceCharacters(document);
  condenseTextNodeWhitespace(document);
  filterListElements(document);

  const inspectionTableRowLimit = 20;
  filterTableElements(document, inspectionTableRowLimit);
  filterLeafElements(document);
  filterHRElements(document);
  trimDocument(document);
  filterElementAttributes(document);
};

// todo; should be part of some normalize whitespace general function?
DOMAid.filterHairSpaceCharacters = function(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const modifiedValue = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(modifiedValue !== value) {
      console.debug('Replaced hair spaces', value, '=>', modifiedValue);
      node.nodeValue = modifiedValue;
    }
  }
};

// Unwraps <noscript> elements. Although this could be done by
// filterUnwrappableElements, I am doing it here because I consider <noscript>
// to be a special case. This unwraps instead of removes because some documents
// embed the entire content in a noscript tag and then use their own scripted
// unwrapping call to make the content available.
//
// TODO: look into whether I can make a more educated guess about whether
// to unwrap or to remove. For example, maybe if there is only one noscript
// tag found, or if the number of elements outside of the node script but
// within the body is above or below some threshold (which may need to be
// relative to the total number of elements within the body?)
DOMAid.filterNoscriptElements = function(document) {
  const elements = document.querySelectorAll('noscript');
  for(let i = 0, len = elements.length; i < len; i++) {
    unwrapElement(elements[i]);
  }
};

// TODO: what if both body and frameset are present?
// TODO: there can be multiple bodies when illformed. Maybe use
// querySelectorAll and handle multi-body branch differently
DOMAid.filterFrameElements = function(document) {
  const framesetElement = document.body;
  if(!framesetElement || framesetElement.nodeName !== 'FRAMESET') {
    return;
  }

  const bodyElement = document.createElement('BODY');
  const noframes = document.querySelector('NOFRAMES');
  if(noframes) {
    for(let node = noframes.firstChild; node; node = noframes.firstChild) {
      bodyElement.appendChild(node);
    }
  } else {
    const errorTextNode = document.createTextNode(
      'Unable to display framed document.');
    bodyElement.appendChild(errorTextNode);
  }

  framesetElement.remove();
  document.documentElement.appendChild(bodyElement);
};

// If a figure has only one child element, then it is useless.
// NOTE: boilerplate analysis examines figures, so ensure this is not done
// before it.
DOMAid.filterFigureElements = function(document) {
  const figures = document.querySelectorAll('FIGURE');
  for(let i = 0, len = figures.length; i < len; i++) {
    let figure = figures[i];
    if(figure.childElementCount === 1) {
      unwrapElement(figure);
    }
  }
};
