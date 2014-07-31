// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.markupOutput = function(doc, bestElement, options) {

  var exposeAttributes = lucu.calamine.exposeAttributes.bind(this, options);
  var elements = doc.body.getElementsByTagName('*');
  lucu.element.forEach(elements, exposeAttributes);

  lucu.calamine.highlightBestElement(doc, bestElement, options);
};

lucu.calamine.exposeAttributes = function(options, element)  {

  // TODO: short-circuited and is poor convention. Rewrite using ifs.

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
};

lucu.calamine.highlightBestElement = function(doc, bestElement, options) {
  if(!options.HIGHLIGHT_MAX_ELEMENT) {
    return;
  }

  // TODO: shouldn't this be bestElement == doc.body ??

  if(bestElement == doc) {
    bestElement.body.style.border = '2px solid green';
  } else {
    bestElement.style.border = '2px solid green';
  }
};
