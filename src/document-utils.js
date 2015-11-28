// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Document utility functions
const DocumentUtils = {};

// todo: create a setImageDimensions document transform,
// then delete document-utils.js
// update callers, html includes
// when doing that, i can consider moving image utils
// stuff into this, and deprecating image utils as well

// Asynchronously attempts to set the width and height for 
// all image elements
DocumentUtils.setImageDimensions = function(document, callback) {
  const images = document.getElementsByTagName('img');
  async.forEach(images, ImageUtils.fetchDimensions, callback);
};
