// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: consider merging all filters into a single recursive
// function, this might remove some of the redundancy that happens and some
// of the issues with non-associativeness of filters. Order shouldn't affect
// the outcome as much.

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

  DOMAid.replaceBRElements(document);
  filterAnchorElements(document);

  filterImageElements(document);

  filterUnwrappableElements(document);
  DOMAid.filterFigureElements(document);
  condenseTextNodeWhitespace(document);
  filterListElements(document);

  const inspectionRowLimit = 20;
  filterTableElements(document, inspectionRowLimit);
  filterLeafElements(document);
  DOMAid.filterMisplacedHRElements(document);
  DOMAid.filterConsecutiveHRElements(document);

  // TODO: deprecate once replaceBRElements is fixed?
  DOMAid.filterConsecutiveBRElements(document);
  trimDocument(document);
  filterElementAttributes(document);
};

// TODO: this should use the query selector itself to look for the
// hierarchical relationship, not the code. It is something like
// 'ul > hr'
// TODO: technically I probably want to move any elements that are child of
// list that are not li elements, with the exception maybe for 'form'?
// TODO: look into naming it something more akin to how its implemented in dom,
// something like NodeHierarchyError or whatever it is called
DOMAid.filterMisplacedHRElements = function(document) {
  const hrs = document.querySelectorAll('hr');
  for(let i = 0, len = hrs.length; i < len; i++) {
    let hr = hrs[i];
    if(hr.parentNode.nodeName.toUpperCase() === 'UL') {
      hr.remove();
    }
  }
};

// Unwraps <noscript> elements. Although this could be done by
// filterUnwrappables, I am doing it here because I consider <noscript> to be
// a special case. This unwraps instead of removes because some documents
// embed the entire content in a noscript tag and then use their own scripted
// unwrapping call to make the content available.
//
// TODO: look into whether I can make a more educated guess about whether
// to unwrap or to remove. For example, maybe if there is only one noscript
// tag found, or if the number of elements outside of the node script but
// within the body is above or below some threshold (which may need to be
// relative to the total number of elements within the body?)
DOMAid.filterNoscriptElements = function(document) {
  const elementNodeList = document.querySelectorAll('noscript');
  const nullReferenceNode = null;
  for(let i = 0, len = elementNodeList.length; i < len; i++) {
    unwrapElement(elementNodeList[i], nullReferenceNode);
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

DOMAid.filterConsecutiveHRElements = function(document) {
  const elements = document.querySelectorAll('HR');
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    let prev = element.previousSibling;
    if(prev && prev.nodeName === 'HR') {
      prev.remove();
    }
  }
};

// TODO: merge with replaceBRElements
DOMAid.filterConsecutiveBRElements = function(document) {
  const elements = document.querySelectorAll('BR');
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    let prev = element.previousSibling;
    if(prev && prev.nodeName === 'BR') {
      prev.remove();
    }
  }
};

// TODO: improve, this is very buggy
// error case: http://paulgraham.com/procrastination.html
// TODO: I think using substrings and insertAdjacentHTML might actually
// be the simplest solution? Cognitively, at least.
DOMAid.replaceBRElements = function(document) {
  const nodeList = document.querySelectorAll('BR');
  for(let i = 0, len = nodeList.length; i < len; i++) {
    //let brElement = nodeList[i];
    //brElement.renameNode('p');
    //parent = brElement.parentNode;
    //p = document.createElement('P');
    //parent.replaceChild(p, brElement);
  }
};

// If a figure has only one child element, then it is useless.
// NOTE: boilerplate analysis examines figures, so ensure this is not done
// before it.
DOMAid.filterFigureElements = function(document) {
  const figures = document.querySelectorAll('FIGURE');
  for(let i = 0, len = figures.length; i < len; i++) {
    let figure = figures[i];
    if(figure.childElementCount === 1) {
      unwrapElement(figure, null);
    }
  }
};
