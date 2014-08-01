// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.transformBreaks = function(doc) {

  // Not yet implemented
  // BUGGY: in process of fixing
  // NOTE: calamineTransformRuleElement no longer exists
  // lucu.element.forEach(doc.body.querySelectorAll('br,hr'), calamineTransformRuleElement);
};


// Trying to break apart break rule elements by block
// UNDER DEVELOPMENT
lucu.calamine.testSplitBR = function(str) {
  if(!str) return;

  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;

  // TODO: use the isInline function defined somewhere, do not redefine
  var isInline = function(element) {
    return element.matches('a,abbr,acronym,b,bdo,big,blink,cite,code,dfn,'+
      'em,kbd,i,q,samp,small,span,strong,sub,sup,tt,var');
  };

  var insertAfter = function(newElement, oldElement) {
    if(oldElement.nextSibling) {
      oldElement.parentElement.insertBefore(newElement, oldElement.nextSibling);
    } else {
      oldElement.parentElement.appendChild(newElement);
    }
  };

  var peek = function(arr) {
    return arr[arr.length - 1];
  }

  var splitBlock = function(element) {

    var root = element.ownerDocument.body;

    // Find the path from the element to the first blocking element.
    var parent = element.parentElement;
    var path = [parent];
    while(isInline(parent)) {
      parent = parent.parentElement;
      path.push(parent);
    }

    if(peek(path) == root) {
      // We could have inline elements or text siblings
      // We have to create artificial block parents
      //var prev = doc.createElement('p');
      //var next = doc.createElement('p');

      return;
    }

    // Rebuilt the path and previous siblings
    //while(path.length) {
     // parent = path.pop();
    //}
  };

  Array.prototype.forEach.call(doc.body.getElementsByTagName('br'), splitBlock);
  return doc.body.innerHTML;
};
