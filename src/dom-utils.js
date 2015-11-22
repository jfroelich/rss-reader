// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const DOMUtils = {};

// Parses the html string and returns an HTMLDocument instance
// NOTE: is practically equivalent to using DOMParser
DOMUtils.parseHTML = function(html) {
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.innerHTML = html;
  return doc;
};

// Replaces an element with its children in the element's document
// NOTE: not optimized for live documents
DOMUtils.unwrap = function(element) {
  const parent = element.parentElement;
  if(parent) {
    while(element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    element.remove();
  }
};

// Finds the associated caption for an image element
DOMUtils.findCaption = function(image) {
  const parents = DOMUtils.getAncestors(image);
  const figure = parents.find(function(parent) {
  	return parent.localName === 'figure';
  });
  if(figure)
    return figure.querySelector('figcaption');
};

// Returns an array of ancestor elements for the given element
// up to and including the documentElement, in bottom up order
DOMUtils.getAncestors = function(element) {
  const parents = [];
  let parent = element.parentElement;
  while(parent) {
    parents.push(parent);
    parent = parent.parentElement;
  }
  return parents;
};
