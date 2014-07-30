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



/*

TODO: unwrap javascript: anchors

TODO: support iframes and embed objects and audio/video
TODO: for all iframes, set sandbox attribute?
TODO: refactor to use block generation. Group list items together. Group
dds together, etc.
TODO: refactor to use block weighting. The return signature is simply
those blocks above a minimum threshold, which could be based on a
percentage of blocks to return value. But this time use the element
weighting technique. Consider treating divs as inline and using
only certain block parents (e.g. look for ul/ol/p/img/iframe as the only
allowable block segments).
TODO: do not necessarily exclude textnodes that are immediate children of body.
All top level text should probably be converted to paragraphs before scoring.
TODO: include other proximate or high scoring elements outside of the
best element, then rescan and filter out any extreme boilerplate
such as certain lists or ads. When building the frag, consider removing
each element from the original body such that each successive search for
another element does not have perform intersection tests.
TODO: the more I think about the above, the more I think I should go
back to blocks (which would simplify BR split), but this time add in
hierarchical weighting. The crux of the problem then becomes how
pick the blocks to return. I would have to incorporate some better
all blocks in this element type of biasing that promotes blocks like
they do now, but also get rid of upward propagation.
NOTE: this wouldn't simplify the BR transform, that is still screwed up
NOTE: The fundamental problem is that I am not obtaining "all" of the desired
elements from the age because sometimes they are not all in the same block.
And when I do get the parent element right, sometimes I still end up
getting alot of nested boilerplate. At that point I would need to filter
the boilerplate, at which point I am nearly back to block score.

TODO: look into alternatives to expandos (using dom as the dataset). There are reported
issues, warnings against extending native host objects, performance warnings against
shape changes, etc.
1) create a single custom object per element during feature extraction. store all
custom properties in this single custom object. Then, when all is said and done,
use delete node.customObjectName on all nodes, and then produce the results. This
ensures, even if it is not a problem, that no added references remain, so there is
no risk of keeping around unwanted references later
2) do not store any custom properties in the nodes. Separately store a set of properties
that contains references to nodes, like a big wrapper. Then just nullify or not return to
let the references be eventually gced. jquery accomplishes this by giving element a
GUID, then using the GUID to map between the element object and its cached reference
in a corresponding wrapper object. Gross.
3) Use attributes. This would not work. We need properties for text nodes, which are
not elements, and thus do not have attributes. Also, attributes are strings, and we
want to use numbers and booleans and other primitives, leading to alot of unecessary
type coercion.
4) Use data-* attirbutes. This again would not work, for all the same reasons as #3.
5) use several custom properties. make sure not to create references to elements, only
use separate primitive-like values (although those may turn into objects depending on how
they are used, like true.toString()).make sure to cleanup? cleanup may not even be
necessary. really it depends on underestanding how chrome deals with non-native properties
of elements. one concern is that chrome may not even provide in-memory objects for nodes
until those nodes are accessed, and by setting custom properties, it flags that the node has
to remain in mem, which means that by setting any one custom property on a node, it make
it persist in mem. the second concern is the dereferencing, whether the custom property
can be a contributing factor in preventing GC after the node is detached from the DOM.

According to http://canjs.com/docco/node_lists.html, trying to set an expando on a
node in certain browsers causes an exception
Good explanation of the basic leaks:
http://www.javascriptkit.com/javatutors/closuresleak/index3.shtml
*/