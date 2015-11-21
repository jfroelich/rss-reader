// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const LeafFilter = {};

{



// TODO: there is a specific edge case not being handled
// where certain elements, e.g. anchors, that do not contain
// any child nodes, should be considered empty. And this must
// be recursive as well, up the tree.
// In the case of <ul><li><a></a></li></ul>, the result should
// be that the entire subtree is removed.
// Because this case is not currently handled, and because we
// remove other nodes, this leads to some funny looking junk
// areas of content (e.g. a list of empty bullet points)
// This gets trickier because the logic, in the current impl,
// has to be in a couple places. In isLeafElement, an anchor without
// a firstChild should be considered empty. That should be handled
// right now but for some odd reason it is not. Then once any element
// is removed and we check its parent, its parent should go through
// the same logic, which does not seem to happen, even though
// the logic is plainly there to do that.

// TODO: removes should happen only once on the shallowest
// parent. If this were called on a live doc we would be causing
// several unecessary reflows. For example, in the case of
// <div><p></p><p></p></div>, there are 3 remove operations,
// when only 1 needed to occur. To do this, this needs
// to be fundamentally refactored. Removes should not occur
// on the first pass over the elements. This, btw, would remove the
// ugliness of using a map function with a side effect. Instead, start by
// identifying all of the empty leaves. Then, for each leaf, traverse
// upwards to find the actual element to remove. Be cautious
// about simply checking that parent.childElementCount == 1 to find
// a removable parent because it is false in the case that two
// or more empty-leaves share the same parent. The criteria instead is
// that a parent is removable if all of its children are removable.
// So we need to go up 1, then query all direct children. But that is
// kind of redundant since we already identified the children, so that
// still might need improvement.

// TODO: just add children that should be removed to the stack insead of
// removing them and adding their parents to the stack.
// Remove all the empty children and shove all the parents on the stack


// rename to selector
const LEAF_EXCEPTIONS = ['area', 'audio', 'br', 'canvas', 'col',
  'hr', 'img', 'source', 'svg', 'track', 'video'].join(',');


LeafFilter.transform = function(document, rest) {

  const elements = document.getElementsByTagName('*');
  
  const leaves = [];
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
  	const element = elements[i];
    if(!element.firstChild && !element.matches(LEAF_EXCEPTIONS)) {
      leaves.push(element);
    }
  }

  const parents = leaves.map(function(element) {
    const parent = element.parentElement;
    element.remove();
    return parent;
  });
  const stack = parents.filter(function(document, element) {
    // TODO: why test for document.body per iteration?
    // TODO: somehow observed an undefined document, need to look
    // into how that could possibly happen
    if(document) {
      return document.body && document.body != element;        
    }
  });

  let parent, grandParent;

  while(stack.length) {
    parent = stack.pop();

    if(parent.firstChild) {
      // There are other nodes in the parent after the child was removed,
      // so do not remove the parent.
      continue;
    }

    // Grab a reference to the grand parent before removal
    // because after removal it is undefined
    grandParent = parent.parentElement;

    parent.remove();

    // If there was no grand parent (how would that ever happen?)
    // or the grand parent is the root, then do not add the new
    // grand parent to the stack
    if(!grandParent || grandParent === document.body || 
      grandParent === document.documentElement) {
      continue;
    }

    stack.push(grandParent);
  }

};




}
