// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Document utility functions
const DocumentUtils = {};

// TODO: try and support lazy loading, I've now witnessed this a few times
// <img 
// src="//pop.h-cdn.co/assets/popularmechanics/20151117153941/images/blank.png" 
// class="lazy-image" 
// data-src="//pop.h-cdn.co/assets/popularmechanics/20151117153941
// /images/logo-network-men.png" 
// alt="Hearst Corporation">
// Maybe what we do is scan all attributes for values that look like 
// urls and try and resolve them?
// http://stackoverflow.com/questions/1500260
// todo; this lazyloader could be a doc tranform


// todo; this should be its own transform
// Asynchronously attempts to set the width and height for 
// all image elements
DocumentUtils.setImageDimensions = function(document, callback) {
  const images = document.getElementsByTagName('img');
  async.forEach(images, ImageUtils.fetchDimensions, callback);
};
