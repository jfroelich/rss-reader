// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

// Functions for sanitizing, removing boilerplate

// Returns a DocumentFragment
lucu.calamine.transformDocument = function(doc, options) {

  // Expects this instanceof lucu.calamine

  options = options || {};
  this.preprocess(doc);
  this.extractFeatures(doc);
  this.score(doc);
  this.filterAttributes(doc, options);

  var bestElement = lucu.calamine.findBestElement(doc);

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

  // Expose some attributes for debugging
  lucu.element.forEach(doc.body.getElementsByTagName('*'), function(element) {
    options.SHOW_BRANCH && element.branch &&
      element.setAttribute('branch', element.branch);
    options.SHOW_ANCHOR_DENSITY && element.anchorDensity &&
      element.setAttribute('anchorDensity', element.anchorDensity.toFixed(2));
    options.SHOW_CHAR_COUNT && element.charCount &&
      element.setAttribute('charCount', element.charCount);
    options.SHOW_COPYRIGHT_COUNT && element.copyrightCount &&
      element.setAttribute('copyrightCount', element.copyrightCount);
    options.SHOW_DOT_COUNT && element.dotCount &&
      element.setAttribute('dotCount', element.dotCount);
    options.SHOW_IMAGE_BRANCH && element.imageBranch &&
      element.setAttribute('imageBranch', element.imageBranch);
    options.SHOW_PIPE_COUNT && element.pipeCount &&
      element.setAttribute('pipeCount', element.pipeCount);
    options.SHOW_SCORE && element.score &&
      element.setAttribute('score', element.score.toFixed(2));
  });

  if(options.HIGHLIGHT_MAX_ELEMENT) {
    if(bestElement == doc) {
      bestElement.body.style.border = '2px solid green';
    } else {
      bestElement.style.border = '2px solid green';
    }
  }

  // Build and return the results
  var results = doc.createDocumentFragment();
  if(bestElement == doc.body) {

    // TODO: bind Node.prototype.appendChild instead here
    var forEach = Array.prototype.forEach;
    forEach.call(doc.body.childNodes, function(element) {
      results.appendChild(element);
    });
  } else {
    results.appendChild(bestElement);
  }
  return results;
};
