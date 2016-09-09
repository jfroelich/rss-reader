// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Applies a series of filters to a document. Modifies the document
// in place. The filters are applied in a preset order so as to minimize the
// work done by each sequential step, and to ensure proper handling of
// things like frameset elements.
function sanitizeDocument(doc) {
  filterCommentNodes(doc);
  filterFrames(doc);
  filterNoscripts(doc);
  filterBlacklistedElements(doc);
  filterHiddenElements(doc);
  adjustBlockInlineElements(doc);
  filterBRElements(doc);
  filterAnchorElements(doc);
  filterImageElements(doc);
  filterUnwrappableElements(doc);
  filterFigures(doc);
  filter_hair_spaces(doc);
  condenseTextNodeWhitespace(doc);
  unwrapSingleItemLists(doc);

  const limit = 20;
  filterTableElements(doc, limit);
  filterLeafElements(doc);
  filterHRElements(doc);
  trimDocument(doc);
  filterElementAttributes(doc);
}

// TODO: should be part of some normalize whitespace general function?
function filter_hair_spaces(doc) {
  const it = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const modifiedValue = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(modifiedValue !== value) {
      console.debug('Replaced hair spaces', value, '=>', modifiedValue);
      node.nodeValue = modifiedValue;
    }
  }
}

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
function filterNoscripts(doc) {
  const elements = doc.querySelectorAll('noscript');
  for(let i = 0, len = elements.length; i < len; i++) {
    unwrapElement(elements[i]);
  }
}

// TODO: what if both body and frameset are present?
// TODO: there can be multiple bodies when illformed. Maybe use
// querySelectorAll and handle multi-body branch differently
function filterFrames(doc) {
  const frameset = doc.body;
  if(!frameset || frameset.localName !== 'frameset') {
    return;
  }

  const body = doc.createElement('body');
  const noframes = doc.querySelector('noframes');
  if(noframes) {
    for(let node = noframes.firstChild; node; node = noframes.firstChild) {
      body.appendChild(node);
    }
  } else {
    const error_node = doc.createTextNode(
      'Unable to display framed document.');
    body.appendChild(error_node);
  }

  frameset.remove();
  doc.documentElement.appendChild(body);
}

// If a figure has only one child element, then it is useless.
// NOTE: boilerplate analysis examines figures, so ensure this is not done
// before it.
// TODO: is it actually useless?
function filterFigures(doc) {
  const figures = doc.querySelectorAll('FIGURE');
  for(let i = 0, len = figures.length; i < len; i++) {
    let figure = figures[i];
    if(figure.childElementCount === 1) {
      unwrapElement(figure);
    }
  }
}

this.sanitizeDocument = sanitizeDocument;

} // End file block scope
