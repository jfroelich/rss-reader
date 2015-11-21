// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const HiddenElementFilter = {};

HiddenElementFilter.transform = function(document, rest) {
  // These elements are never considered hidden, even if they meet 
  // other conditions
  // todo: externalize constant
  const HIDDEN_ELEMENT_EXCEPTIONS = new Set([
    'noscript',
    'noembed'
  ]);

  // This uses a NodeIterator for traversal 
  // to avoid visiting detached subtrees.
  // This does not test against offsetWidth/Height because the 
  // properties do not appear to be initialized within inert documents

  const it = document.createNodeIterator(
    document.documentElement, NodeFilter.SHOW_ELEMENT);
  let element = it.nextNode();
  while(element) {
    if(!HIDDEN_ELEMENT_EXCEPTIONS.has(element.localName)) {
      const style = element.style;
      const opacity = parseFloat(style.opacity);
      if(style.display === 'none' || 
        style.visibility === 'hidden' || 
        style.visibility === 'collapse' || 
        opacity < 0.3) {
        element.remove();
      }
    }

    element = it.nextNode();
  }
};
