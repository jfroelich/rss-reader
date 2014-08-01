// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

// This is named transform instead of filter or unwrap
// because I want to intentionally remain a bit abstract
// about what this does with noscript elements, because I
// am currently uncertain how to handle them properly.

lucu.calamine.transformNoscripts = function(doc) {

  // Unwrap noscript tags.

  // This step must occur before filtering
  // invisible elements in order to properly deal with the
  // template-unhiding trick uses by many frameworks.
  // NOTE: this causes boilerplate to appear in content, and needs
  // improvement.
  var noscripts = doc.body.querySelectorAll('noscript');
  lucu.element.forEach(noscripts, lucu.element.unwrap);
};
