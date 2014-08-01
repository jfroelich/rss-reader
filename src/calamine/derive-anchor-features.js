// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

// NOTE: if I plan to unwrap anchors, I should probably be doing it before
// this is called, right?

// NOTE: this must be called after deriveTextFeatures because it
// depends on charCount being set
lucu.calamine.deriveAnchorFeatures = function(doc) {
  var anchors = doc.body.getElementsByTagName('a');
  lucu.element.forEach(anchors, lucu.calamine.deriveAnchorFeaturesForElement);
};

// Extract anchor features. Based on charCount from text features
lucu.calamine.deriveAnchorFeaturesForElement = function(anchor) {

  if(!anchor.charCount) {
    return;
  }

  if(!anchor.hasAttribute('href')) {
    return;
  }

  anchor.anchorCharCount = anchor.charCount;

  var doc = anchor.ownerDocument;
  var parent = anchor.parentElement;

  while(parent != doc.body) {
    parent.anchorCharCount = (parent.anchorCharCount || 0 ) + anchor.charCount;
    parent = parent.parentElement;
  }
};
