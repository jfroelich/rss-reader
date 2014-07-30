// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Functions for sanitizing, removing boilerplate

function calamineIsRemovableAttribute(attribute) {
  return attribute.name != 'href' && attribute.name != 'src';
}

function calamineFilterElementAttributes(element) {

  var attributes = Array.prototype.filter.call(
    element.attributes, calamineIsRemovableAttribute);

  var names = attributes.map(function(attribute) {
    return attribute.name;
  });

  var removeAttribute = Element.prototype.removeAttribute.bind(element);
  names.forEach(removeAttribute);
}

/**
 * Returns a DocumentFragment
 */
function calamineTransformDocument(doc, options) {
  options = options || {};

  // TODO: review gebtn, maybe i do not need to keep calling it?
  // e.g. maybe i should just do a single querySelectorAll instead if its not-live?
  // or is it better to re-call it to avoid read-after-delete issues?

  var body = doc.body;

  calaminePreprocessDocument(doc);
  calamineExtractFeaturesInDocument(doc);

  lucu.element.forEach(body.getElementsByTagName('*'), scoreElement);
  lucu.element.forEach(body.getElementsByTagName('*'), applySiblingBias);

  // Remove attributes
  if(options.FILTER_ATTRIBUTES) {
    lucu.element.forEach(body.getElementsByTagName('*'), calamineFilterElementAttributes);
  }

  body.score = -Infinity;
  var bestElement = Array.prototype.reduce.call(body.getElementsByTagName('*'), function(previous, current) {
    // Favor previous, so use > not >=
    return current.score > previous.score ? current : previous;
  }, body);

  var SELECTOR_UNWRAPPABLE = 'a:not([href]),article,big,blink,'+
    'body,center,details,div,font,form,help,html,insert,label,'+
    'legend,nobr,noscript,section,small,span,tbody,thead';

  if(options.UNWRAP_UNWRAPPABLES) {
    var unwrappableElements = body.querySelectorAll(SELECTOR_UNWRAPPABLE);
    lucu.element.forEach(unwrappableElements, function(element) {
      if(element != bestElement) {
        lucu.element.unwrap(element);
      }
    });
  }

  // Expose some attributes for debugging
  lucu.element.forEach(body.getElementsByTagName('*'), function(element) {
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

  // TODO: resolve relative href and src attributes
  var SELECTOR_RESOLVABLE = 'a,applet,audio,embed,iframe,img,object,video';

  // Build and return the results
  var results = doc.createDocumentFragment();
  if(bestElement == body) {

    // TODO: bind Node.prototype.appendChild instead here
    var forEach = Array.prototype.forEach;
    forEach.call(body.childNodes, function(element) {
      results.appendChild(element);
    });
  } else {
    results.appendChild(bestElement);
  }
  return results;
}



// Trying to break apart break rule elements by block
// UNDER DEVELOPMENT
function calamineTestSplitBR(str) {
  if(!str) return;

  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;

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
}
