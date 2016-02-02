// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /dom-filter.js

// Applies a series of transformations to a document in preparation for
// appending it to the UI.
// NOTE: eventually i will want something that can do pre-storage cleanup. That
// function will probably look very similar to this one. In fact it may be
// the same function. However, I an naming this 'for-view' because I want to be
// clear that I am unclear about how it will turn out currently.
// TODO: properly handle noembed
// TODO: support audio/video

function prepareDocumentForView(document) {
  'use strict';

  DOMFilter.filterCommentNodes(document);
  DOMFilter.filterFrameElements(document);
  DOMFilter.filterScriptElements(document);
  DOMFilter.filterNoScriptElements(document);
  DOMFilter.filterJavascriptAnchors(document);
  DOMFilter.filterBlacklistedElements(document);
  DOMFilter.filterHiddenElements(document);
  // DOMFilter.filterBreakruleElements(document);

  // Filter boilerplate using Calamine
  const calamine = new Calamine();
  calamine.analyze(document);
  calamine.prune();

  DOMFilter.filterSourcelessImages(document);
  DOMFilter.filterTracerImages(document);
  DOMFilter.normalizeWhitespace(document);

  DOMFilter.filterInlineElements(document);

  const sensitiveElements = DOMFilter.getSensitiveSet(document);
  DOMFilter.condenseNodeValues(document, sensitiveElements);
  DOMFilter.filterNominalAnchors(document);
  DOMFilter.trimTextNodes(document, sensitiveElements);
  DOMFilter.filterEmptyTextNodes(document);
  DOMFilter.filterLeafElements(document);
  DOMFilter.filterSingleItemLists(document);
  DOMFilter.filterSingleCellTables(document);
  DOMFilter.filterSingleColumnTables(document);
  DOMFilter.trimDocument(document);
  DOMFilter.filterAttributes(document);
}
