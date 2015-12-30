// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Applies a series of transformations to a document in preparation for
// appending it to the UI.
// NOTE: eventually i will want something that can do pre-storage cleanup. That
// function will probably look very similar to this one. In fact it may be
// the same function. However, I an naming this 'for-view' because I want to be
// clear that I am unclear about how it will turn out currently.

function prepareDocumentForView(document) {
  'use strict';
  // TODO: properly handle noembed
  // NOTE: support audio/video

  filterCommentNodes(document);
  filterFrameElements(document);
  filterScriptElements(document);
  filterBlacklistedElements(document);
  filterHiddenElements(document);
  // filterBreakruleElements(document);

  // Filter boilerplate using Calamine
  const calamine = new Calamine();
  calamine.analyze(document);
  calamine.prune();

  filterSourcelessImages(document);
  filterTracerElements(document);
  normalizeNodeWhitespace(document);
  filterInlineElements(document);
  trimTextNodes(document);
  filterLeafElements(document);
  unwrapSingletonLists(document);
  unwrapSingletonTables(document);
  trimDocumentElements(document);
  filterElementAttributes(document);
}
