// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const FallbackElementsHandler = {};

// Removes fallback elements such as noscript and noframes. 

// noframes is no longer supported in HTML5 but we still want to be able
// to process such pages. 

// We unwrap instead of remove because some websites use a 
// content-loading trick to render a document which involves a script
// 'revealing' the inner contents of a noscript element.

// TODO: maybe there is a better way to special case this because right 
// now it occassionally causes a very unwanted side effect where content
// that was supposed to be normally hidden becomes visible.

// TODO: we should also consider weighting children against becoming 
// the best element, or weighting children as more likely to be 
// boilerplate (more/less likely to be content). This is more of a 
// calamine scoring todo.

FallbackElementsHandler.transform = function(document, rest) {
  const elements = document.querySelectorAll('noscript, noframes');
  for(let i = 0, len = elements.length; i < len; i++) {
    Calamine.unwrap(elements[i]);
  }
};
