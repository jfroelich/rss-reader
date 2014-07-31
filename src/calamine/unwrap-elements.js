// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.SELECTOR_UNWRAPPABLE = 'a:not([href]),article,big,blink,'+
  'body,center,details,div,font,form,help,html,insert,label,'+
  'legend,nobr,noscript,section,small,span,tbody,thead';

lucu.calamine.unwrapElements = function(doc, bestElement, options) {

  if(!options.UNWRAP_UNWRAPPABLES) {
    return;
  }

  var unwrappables = doc.body.querySelectorAll(lucu.calamine.SELECTOR_UNWRAPPABLE);
  var notBest = lucu.calamine.isNotBestElement.bind(this, bestElement);
  var lessBest = lucu.element.filter(unwrappables, notBest);
  lessBest.forEach(lucu.element.unwrap);

  //lucu.element.forEach(unwrappables, function(element) {
  //  if(element != bestElement) {
  //    lucu.element.unwrap(element);
  //  }
  //});
};

lucu.calamine.isNotBestElement = function(bestElement, element) {
  return bestElement != element;
};
