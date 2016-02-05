// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var VNodeTest = {};

VNodeTest.startTests = function() {
  console.log('Running VNode tests');
};

VNodeTest.startTests();

VNodeTest.construct = function() {
  'use strict';
  console.group('Running VNode construction tests');
  const node = new VNode();
  console.log('Created VNode instance? ', !!node);

  const p = VNode.createElement('p');
  console.log('Created element?', !!p);
  console.log('Element is type element?', p.isElement());
  console.log('Element has proper tag name?', p.name === 'p');
  console.log('Element does not have a value?', !p.value);

  const textNode = VNode.createTextNode('Hello');
  console.log('Created text node?', !!textNode);
  console.log('Text node is type text?', textNode.isText());
  console.log('Text node has correct value?', textNode.value === 'Hello');
  console.groupEnd();
};

VNodeTest.construct();

VNodeTest.mayContainChildTest = function() {
  'use strict';
  console.group('Running mayContainChild tests');
  const elementNode = new VNode();
  elementNode.type = Node.ELEMENT_NODE;
  const elementNode2 = new VNode();
  elementNode2.type = Node.ELEMENT_NODE;
  const textNode = new VNode();
  textNode.type = Node.TEXT_NODE;
  const textNode2 = new VNode();
  textNode2.type = Node.TEXT_NODE;
  console.log('Element cannot contain itself?',
    !elementNode.mayContainChild(elementNode));
  console.log('Element node may contain element node?',
    elementNode.mayContainChild(elementNode2));
  console.log('Element node may contain text node?',
    elementNode.mayContainChild(textNode));
  console.log('Text node cannot contain element node?',
    !textNode.mayContainChild(elementNode));
  console.log('Text node cannot contain text node?',
    !textNode.mayContainChild(textNode2));
  console.groupEnd();
};

VNodeTest.mayContainChildTest();

VNodeTest.appendChildTest = function() {
  'use strict';
  console.group('Running VNode appendChild tests');
  const parent = VNode.createElement('p');
  const child = VNode.createElement('p');
  const secondChild = VNode.createElement('p');
  const grandChild = VNode.createTextNode('Hello!');

  const appendChildResult = parent.appendChild(child);
  const appendSecondChildResult = parent.appendChild(secondChild);
  const appendGrandChildResult = child.appendChild(grandChild);

  console.log('Appended a child?', appendChildResult);
  console.log('Appended a second child?', appendSecondChildResult);
  console.log('Appended a grand child?', appendGrandChildResult);

  console.log('Does parent.firstChild equal child?',
    parent.firstChild === child);
  console.log('Does child.parentNode equal parent?',
    child.parentNode === parent);
  console.log('Does parent.lastChild equal secondChild?',
    parent.lastChild === secondChild);
  console.log('Does child.nextSibling equal secondChild?',
    child.nextSibling === secondChild);
  console.log('Does secondChild.previousSibling equal child?',
    secondChild.previousSibling === child);
  console.log('Does secondChild.parentNode equal parent?',
    secondChild.parentNode === parent);
  console.log('Does grandChild.parentNode === child?',
    grandChild.parentNode === child);
  console.log('Is grandChild.nextSibling undefined?',
    !grandChild.nextSibling);
  console.log('Is grandChild.parentNode not secondChild?',
    grandChild.parentNode !== secondChild);

  const selfParent = VNode.createElement('p');
  const selfAppendResult = selfParent.appendChild(selfParent);
  console.log('Unable to append itself as child?', !selfAppendResult);

  const sterile = VNode.createTextNode('sterile');
  const adoptable = VNode.createTextNode('adoptable');
  const sterileAdoptResult = sterile.appendChild(adoptable);
  console.log('Unable to append child to text node?', !sterileAdoptResult);


  console.groupEnd();
};

VNodeTest.appendChildTest();

VNodeTest.appendAttachedChildTest = function() {
  console.group('Running appendAttachedChild tests');

  // TODO: now test 'moves', where the node is already attached to
  // an existing tree and is moved. Test moving to an entirely new tree, and
  // test moving to a different location in the same tree.

  // Test moving to a new tree
  const tree1 = VNode.createElement('tree1');
  const tree2 = VNode.createElement('tree2');
  const treeChangingChild = VNode.createTextNode('treeChangingChild');
  tree1.appendChild(treeChangingChild);
  const changeTreesResult = tree2.appendChild(treeChangingChild);
  console.log('Can move node to different tree?', changeTreesResult);
  console.log('Old tree has no firstChild?', !tree1.firstChild);
  console.log('Old tree has no lastChild?', !tree1.lastChild);
  console.log('Child has proper new parent?',
    treeChangingChild.parentNode === tree2);

  const sameTree = VNode.createElement('sameTree');
  const sameTreeChild1 = VNode.createElement('sameTreeChild1');
  const sameTreeChild2 = VNode.createElement('sameTreeChild2');
  sameTree.appendChild(sameTreeChild1);
  sameTree.appendChild(sameTreeChild2);
  const moveWithinTreeResult = sameTree.appendChild(sameTreeChild1);
  console.log('Can move within same tree?', moveWithinTreeResult);

  // NOTE: left off here, getting failures

  console.log('Correct parent after move within same tree?',
    sameTreeChild1.parentNode === sameTree);
  console.log('Correct firstNode after move within same tree?',
    sameTree.firstChild === sameTreeChild2);
  console.log('Correct lastNode after move within same tree?',
    sameTree.lastChild === sameTreeChild1);
  console.log('Correct nextSiblings after move within same tree?',
    sameTreeChild2.nextSibling === sameTreeChild1 &&
    !sameTreeChild1.nextSibling);
  console.log('Correct previousSiblings after move within same tree?',
    sameTreeChild1.previousSibling === sameTreeChild2 &&
    !sameTreeChild2.previousSibling);

  // TODO: test moving in same tree with siblings involved

  console.groupEnd();
};

VNodeTest.appendAttachedChildTest();
