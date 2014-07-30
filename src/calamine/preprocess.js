// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

// Preps document for feature extraction and analysis
lucu.calamine.preprocess = function(doc) {

  var body = doc.body;
  var forEach = Array.prototype.forEach;

  // Filter comment nodes
  lucu.node.forEach(body, NodeFilter.SHOW_COMMENT, lucu.node.remove);

  // Blacklist/whitelist filtering
  var allElements = doc.body.querySelectorAll('*');
  lucu.element.forEach(allElements, lucu.calamine.filterByElementName);

  // Image filtering
  var imageElements = doc.body.querySelectorAll('img');
  lucu.element.forEach(imageElements, lucu.calamine.filterImage);

  // Unwrap noscript tags. This step must occur before filtering
  // invisible elements in order to properly deal with the
  // template-unhiding trick uses by many frameworks.
  // NOTE: this causes boilerplate to appear in content, and needs
  // improvement.
  var noscripts = doc.body.querySelectorAll('noscript');
  lucu.element.forEach(noscripts, lucu.element.unwrap);

  // Remove invisible elements
  var invisibles = lucu.element.filter(allElements,
    lucu.element.isInvisible);
  invisibles.forEach(lucu.node.remove);


  // BUGGY: in process of fixing
  // lucu.element.forEach(doc.body.querySelectorAll('br,hr'), calamineTransformRuleElement);

  // Marks code/pre elements as whitespaceImportant and then marks all direct and indirect
  // descendant elements as whiteSpaceImportant. Propagating this property from the top
  // down (cascading) enables the trimNode function to quickly determine whether its
  // nodeValue is trimmable, as opposed to having the trimNode function search each text
  // node's axis (path from root) for the presence of a pre/code element.
  lucu.element.forEach(body.querySelectorAll('code, pre'), function(element) {
    element.whitespaceImportant = 1;
    lucu.element.forEach(element.getElementsByTagName('*'), function(descendantElement) {
      descendantElement.whitespaceImportant = 1;
    });
  });

  // TODO: replace &nbsp; with space

  // TODO: Replace &#160; and &nbsp; (and any other such entities) with space
  // before trimming
  // TODO: if not whitespace important condense whitespace
  // e.g. nodeValue = nodeValue.replace(/\s+/g,' ');

  // Trim text nodes. If the text node is between two inline elements, it is not
  // trimmed. If the text node follows an inline element, it is right trimmed. If
  // the text node precedes an ineline element, it is left trimmed. Otherwise the
  // nodeValue is fully trimmed. Then, if the nodeValue is empty, remove the node.
  lucu.node.forEach(body, NodeFilter.SHOW_TEXT, function(node) {
    if(!node.parentElement.whitespaceImportant) {
      if(lucu.element.isInline(node.previousSibling)) {
        if(!lucu.element.isInline(node.nextSibling)) {
          node.nodeValue = node.nodeValue.trimRight();
        }
      } else if(lucu.element.isInline(node.nextSibling)) {
        node.nodeValue = node.nodeValue.trimLeft();
      } else {
        node.nodeValue = node.nodeValue.trim();
      }

      if(!node.nodeValue) {
        node.remove();
      }
    }
  });

  // TODO: cleanup the whitespaceImportant expando?



  // Now remove all empty-like elements from the document. If removing
  // an element would change the state of the element's parent to also
  // meet the empty-like criteria, then the parent is also removed, and
  // so forth, up the hierarchy, but stopping before doc.body.
  // NOTE: using :empty would not produce the desired behavior

  // TODO: removes should happen only once on the shallowest
  // parent. If this were called on a live doc we would be causing
  // several unecessary reflows. For example, in the case of
  // <div><p></p><p></p></div>, there are 3 remove operations,
  // when only 1 needed to occur. To do this, this needs
  // to be fundamentally refactored. Removes should not occur
  // on the first pass over the elements. This, btw, would remove the
  // ugliness of using a map function with a side effet. Instead, start by
  // identifying all of the empty leaves. Then, for each leaf, traverse
  // upwards to find the actual element to remove. Be cautious
  // about simply checking that parent.childElementCount == 1 to find
  // a removable parent because it is false in the case that two
  // or more empty-leaves share the same parent. The criteria instead is
  // that a parent is removable if all of its children are removable.
  // So we need to go up 1, then query all direct children. But that is
  // kind of redundant since we already identified the children, so that
  // still might need improvement.

  allElements = body.getElementsByTagName('*');
  var emptyLikeElements = lucu.element.filter(allElements, function(element) {
    return !element.firstChild && !lucu.element.isLeafLike(element);
  });

  // TODO: just add children that should be removed to the stack insead of
  // removing them and adding their parents to the stack. It is kinda DRY.

  // Remove all the empty children and shove all the parents on the stack
  var stack = emptyLikeElements.map(function(element) {
    var parentElement = element.parentElement;
    parentElement.removeChild(element);
    return parentElement;
  }).filter(function(element) {
    return element != body;
  });

  var parentElement, grandParentElement;

  // NOTE: stack.length might have a really surprising issue, I forget
  // exactly but there is possibly something unexpected regarding
  // popping elements from an array until it is empty, like,
  // the length gets incorrectly updated or something. Something I was
  // reading on stackoverflow about emptying arrays.

  while(stack.length) {
    parentElement = stack.pop();
    if(!parentElement.firstChild) {
      grandParentElement = parentElement.parentElement;
      if(grandParentElement) {
        grandParentElement.removeChild(parentElement);
        if(grandParentElement != body)
          stack.push(grandParentElement);
      }
    }
  }
};
