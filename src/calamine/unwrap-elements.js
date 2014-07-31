// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.unwrapElements = function(doc, bestElement, options) {
  var SELECTOR_UNWRAPPABLE = 'a:not([href]),article,big,blink,'+
    'body,center,details,div,font,form,help,html,insert,label,'+
    'legend,nobr,noscript,section,small,span,tbody,thead';

  if(options.UNWRAP_UNWRAPPABLES) {
    var unwrappableElements = doc.body.querySelectorAll(SELECTOR_UNWRAPPABLE);
    lucu.element.forEach(unwrappableElements, function(element) {
      if(element != bestElement) {
        lucu.element.unwrap(element);
      }
    });
  }
};
