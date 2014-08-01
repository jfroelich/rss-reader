// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

// TODO: This needs a lot of cleanup

lucu.calamine.filterEmptyElements = function(doc) {

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

  var allElements = doc.body.getElementsByTagName('*');
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
    return element != doc.body;
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
        if(grandParentElement != doc.body)
          stack.push(grandParentElement);
      }
    }
  }
};