// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Remove elements that do not intersect with the best element
function calamine_prune(document, bestElement) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  // In order to reduce the number of removals, this uses a contains check
  // to avoid removing elements that exist in the static node list but
  // are descendants of elements removed in a previous iteration. The
  // assumption is that this yields better performance.

  // TODO: instead of doing multiple calls to contains, I think I can use one
  // call to compareDocumentPosition and then check against its result.
  // I am not very familiar with compareDocumentPosition yet, that is the
  // only reason I am not using it.

  const docElement = document.documentElement;
  const elements = bodyElement.querySelectorAll('*');
  const numElements = elements.length;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(!element.contains(bestElement) && !bestElement.contains(element) &&
      docElement.contains(element)) {
      element.remove();
    }
  }
}
