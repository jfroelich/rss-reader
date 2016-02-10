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

VNodeTest.mayContainTest = function() {
  'use strict';
  console.group('Running mayContain tests');
  const elementNode = VNode.createElement('div');
  const elementNode2 = VNode.createElement('div');
  const textNode = VNode.createTextNode('test');
  const textNode2 = VNode.createTextNode('test');
  const voidNode = VNode.createElement('br');
  console.log('Element cannot contain itself?',
    !elementNode.mayContain(elementNode));
  console.log('Element node may contain element node?',
    elementNode.mayContain(elementNode2));
  console.log('Element node may contain text node?',
    elementNode.mayContain(textNode));
  console.log('Text node cannot contain element node?',
    !textNode.mayContain(elementNode));
  console.log('Text node cannot contain text node?',
    !textNode.mayContain(textNode2));
  console.log('Void node cannot contain element?',
    !voidNode.mayContain(elementNode));
  console.log('Void node may contain text node?',
    voidNode.mayContain(textNode));
  console.groupEnd();
};
VNodeTest.mayContainTest();

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

  console.log('Appended a first child?', appendChildResult);
  console.log('Appended a second child?', appendSecondChildResult);
  console.log('Appended a grand child?', appendGrandChildResult);

  console.log('Does parent.firstChild equal first child?',
    parent.firstChild === child);
  console.log('Does first child.parentNode equal parent?',
    child.parentNode === parent);
  console.log('Does parent.lastChild equal second child?',
    parent.lastChild === secondChild);
  console.log('Does first child.nextSibling equal secondChild?',
    child.nextSibling === secondChild);
  console.log('Does second child.previousSibling equal first child?',
    secondChild.previousSibling === child);
  console.log('Does second child.parentNode equal parent?',
    secondChild.parentNode === parent);
  console.log('Does grand child.parentNode equal first child?',
    grandChild.parentNode === child);
  console.log('Is grand child.nextSibling undefined?',
    !grandChild.nextSibling);
  console.log('Is grand child.parentNode not second child?',
    grandChild.parentNode !== secondChild);

  const selfParent = VNode.createElement('p');
  const selfAppendResult = selfParent.appendChild(selfParent);
  console.log('Unable to append itself as child?', !selfAppendResult);

  const sterile = VNode.createTextNode('sterile');
  const adoptable = VNode.createTextNode('adoptable');
  const sterileAdoptResult = sterile.appendChild(adoptable);
  console.log('Unable to append child to text node?', !sterileAdoptResult);

  // Test re-appending
  const reappendParent = VNode.createElement('reappendParent');
  const reappendChild = VNode.createTextNode('reappendChild');
  reappendParent.appendChild(reappendChild);
  const reappendParentBeforeReappend = reappendChild.parentNode;
  const reappendResult = reappendParent.appendChild(reappendParent.lastChild);
  console.log('Re-appending last child is successful no-op?',
    reappendResult);
  console.log('Re-appended last child is still last child?',
    reappendParent.lastChild === reappendChild);
  console.log('Re-appended child parent is unchanged?',
    reappendParentBeforeReappend === reappendChild.parentNode);

  console.groupEnd();
};

VNodeTest.appendChildTest();

VNodeTest.appendAttachedChildTest = function() {
  'use strict';
  console.group('Running appendAttachedChild tests');

  // Test inter-tree moves
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

  // Test intra-tree moves
  const sameTree = VNode.createElement('sameTree');
  const sameTreeChild1 = VNode.createElement('sameTreeChild1');
  const sameTreeChild2 = VNode.createElement('sameTreeChild2');
  sameTree.appendChild(sameTreeChild1);
  sameTree.appendChild(sameTreeChild2);
  const moveWithinTreeResult = sameTree.appendChild(sameTreeChild1);
  console.log('Can move within same tree?', moveWithinTreeResult);
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

  console.groupEnd();
};
VNodeTest.appendAttachedChildTest();

VNodeTest.removeTest = function() {
  'use strict';
  console.group('Running remove tests');

  const parent = VNode.createElement('parent');
  const child1 = VNode.createElement('child1');
  const child2 = VNode.createElement('child2');
  parent.appendChild(child1);
  parent.appendChild(child2);
  const parentFirstChildBeforeRemove = parent.firstChild;
  const removeResult = child1.remove();
  console.log('Successfully removed child1 from parent?', removeResult);

  console.log('Parent first child changed as result of remove?',
    parentFirstChildBeforeRemove !== parent.firstChild);
  console.log('Parent firstChild is now child2?',
    parent.firstChild === child2);

  console.log('Parent lastChild is still child2?',
    parent.lastChild === child2);
  console.log('child1 now has no parent?', !child1.parentNode);
  console.log('child1 nextSibling is now undefined?',
    !child1.nextSibling);
  console.log('child1 previousSibling is still undefined?',
    !child1.previousSibling);
  console.log('child1 still has no children?',
    !child1.firstChild && !child1.lastChild);
  console.log('child2 previousSibling is now undefined?',
    !child2.previousSibling);
  console.log('child2 nextSibling is still undefined?',
    !child2.nextSibling);
  console.log('child2 parent is still parent?',
    child2.parentNode === parent);

  const detached = VNode.createElement('detached');
  const removeDetachedResult = detached.remove();
  console.log('Removed detached node is successful no-op?',
    removeDetachedResult);
  console.groupEnd();
};
VNodeTest.removeTest();

VNodeTest.insertBeforeTest = function() {
  'use strict';
  console.group('Running insertBefore tests');

  const parent = VNode.createElement('parent');
  const newChild = VNode.createElement('newChild');
  const refChild = VNode.createElement('refChild');
  parent.appendChild(refChild);

  const insertBeforeResult = parent.insertBefore(newChild, refChild);
  console.log('Calling insertBefore was successful?', insertBeforeResult);
  console.log('Parent.firstChild is inserted node?',
    parent.firstChild === newChild);
  console.log('Parent.lastChild is still ref node?',
    parent.lastChild === refChild);
  console.log('Inserted child has proper parent?',
    newChild.parentNode === parent);
  console.log('Reference child still has proper parent?',
    refChild.parentNode === parent);
  console.log('Inserted child next sibling is ref node?',
    newChild.nextSibling === refChild);
  console.log('Inserted child previousSibling is undefined?',
    !newChild.previousSibling);
  console.log('Reference node next sibling is still undefined?',
    !refChild.nextSibling);
  console.log('Reference node previous sibling is inserted child?',
    refChild.previousSibling === newChild);

  // TODO: test when refNode is undef
  const undefParent = VNode.createElement('undefParent');
  const undefNewChild = VNode.createElement('undefNewChild');
  const undefRefNode = void 0;
  const undefInsertResult = undefParent.insertBefore(undefNewChild,
    undefRefNode);
  console.log('Insert before undefined reference node is successful op?',
    undefInsertResult);
  console.log('Inserted child has proper parent?',
    undefNewChild.parentNode === undefParent);

  // Test when newChild was already attached (a MOVE OP)
  const tree1 = VNode.createElement('tree1');
  const attChild = VNode.createElement('attChild');
  const tree2 = VNode.createElement('tree2');
  const attRefChild = VNode.createElement('refChild');
  tree1.appendChild(attChild);
  tree2.appendChild(attRefChild);
  const insertAttResult = tree2.insertBefore(attChild, attRefChild);
  console.log('Inserting attached node is successful?',
    insertAttResult);
  console.log('Inserting attached node emptied old parent?',
    !tree1.firstChild && !tree1.lastChild);
  console.log('Moved node has proper new parent?',
    attChild.parentNode === tree2);
  console.log('Moved node has proper next sibling?',
    attChild.nextSibling === attRefChild);
  console.log('Moved node has proper prev sibling?',
    !attChild.previousSibling);
  console.log('Reference node still has proper next sibling?',
    !attRefChild.nextSibling);
  console.log('Reference node previous sibling is now moved node?',
    attRefChild.previousSibling === attChild);
  console.log('New parent has proper firstChild?',
    tree2.firstChild === attChild);
  console.log('New parent still has proper last child?',
    tree2.lastChild === attRefChild);

  console.groupEnd();
};
VNodeTest.insertBeforeTest();

VNodeTest.replaceChildTest = function() {
  'use strict';
  console.group('Running replaceChild tests');

  const parent = VNode.createElement('parent');
  const newChild = VNode.createElement('newChild');
  const oldChild = VNode.createElement('oldChild');
  parent.appendChild(oldChild);

  const replaceResult = parent.replaceChild(newChild, oldChild);
  console.log('replaceChild was successful op?', replaceResult);
  console.log('oldChild parent is not parent?',
    oldChild.parentNode !== parent);
  console.log('parent firstChild is not old child?',
    parent.firstChild !== oldChild);
  console.log('parent lastChild is not old child?',
    parent.lastChild !== oldChild);
  console.log('parent firstChild is new child?',
    parent.firstChild === newChild);
  console.log('parent lastChild is new child?',
    parent.lastChild === newChild);
  console.log('newChild parent is parent?',
    newChild.parentNode === parent);
  console.log('newChild not sibling of oldChild?',
    newChild.nextSibling !== oldChild &&
    newChild.previousSibling !== oldChild &&
    oldChild.nextSibling !== newChild &&
    oldChild.previousSibling !== newChild);
  console.log('newChild has no siblings?',
    !newChild.nextSibling && !newChild.previousSibling);

  // Test replacing a child with a new child that was previously attached
  const tree1 = VNode.createElement('tree1');
  const tree2 = VNode.createElement('tree2');
  const tree1Child = VNode.createElement('tree1Child');
  const tree2Child = VNode.createElement('tree2Child');
  tree1.appendChild(tree1Child);
  tree2.appendChild(tree2Child);
  const replaceAttachedResult = tree1.replaceChild(tree2Child, tree1Child);
  console.log('Replace attached child op success?',
    replaceAttachedResult);
  console.log('Old tree is now empty?',
    !tree2.firstChild && !tree2.lastChild && tree2Child.parentNode !== tree2 &&
    tree1Child.parentNode !== tree2);
  console.log('Replace attached child changed parent properly?',
    tree2Child.parentNode === tree1);

  console.groupEnd();
};
VNodeTest.replaceChildTest();

VNodeTest.closestTest = function() {
  'use strict';
  console.group('Running closest tests');

  const parent = VNode.createElement('parent');
  const child = VNode.createElement('child');
  const grandChild = VNode.createTextNode('grandChild');
  parent.appendChild(child);
  child.appendChild(grandChild);

  const closestIsChild = grandChild.closest(function(node) {
    return node.name === 'child';
  });

  console.log('Closest ancestor named child is named child?',
    closestIsChild === child);

  const closestIsParent = grandChild.closest(function(node) {
    return node.name === 'parent';
  });
  console.log('Closest ancestor named parent is named parent?',
    closestIsParent === parent);

  const closestIsUndef = grandChild.closest(function(node) {
    return false;
  });
  console.log('Closest undefined is undefined?', !closestIsUndef);

  const grandParent = VNode.createElement('grandParent');
  grandParent.appendChild(parent);
  const closestOfMultiple = grandChild.closest(function(node) {
    return node.name === 'parent' || node.name === 'grandParent';
  });
  console.log('Closest of multiple is parent',
    closestOfMultiple === parent);

  const closestOfNoAncestors = grandParent.closest(function(node) {
    return true;
  });
  console.log('Closest match-any on root is still undefined?',
    !closestOfNoAncestors);

  const closestSelf = parent.closest(function(node) {
    return node.name === 'parent';
  });
  console.log('Closest excludes self?', !closestSelf);

  console.groupEnd();
};
VNodeTest.closestTest();

VNodeTest.parentElementTest = function() {
  'use strict';
  console.group('Running parentElement tests');

  const parent = VNode.createElement('parent');
  const child = VNode.createTextNode('child');
  const notChild = VNode.createTextNode('notChild');
  parent.appendChild(child);
  console.log('child.parentElement is parent?',
    child.parentElement === parent);
  console.log('non child parentElement is undefined?',
    !notChild.parentElement);

  console.groupEnd();
};
VNodeTest.parentElementTest();

VNodeTest.elementChildTests = function() {
  'use strict';
  console.group('Running elementChild tests');

  const parent = VNode.createElement('parent');
  const textChild = VNode.createTextNode('textChild');
  const childElement1 = VNode.createElement('childElement1');
  const childElement2 = VNode.createElement('childElement2');
  parent.appendChild(textChild);
  parent.appendChild(childElement1);
  parent.appendChild(childElement2);

  console.log('parent.firstElementChild is childElement1?',
    parent.firstElementChild === childElement1);
  console.log('parent.lastElementChild is childElement2?',
    parent.lastElementChild === childElement2);
  console.log('childElement.firstElementChild is undefined?',
    !childElement1.firstElementChild);
  console.log('childElement.lastElementChild is undefined?',
    !childElement1.lastElementChild);

  console.log('parent.childElementCount is 2?',
    parent.childElementCount === 2);
  console.log('childElement.childElementCount is 0?',
    childElement1.childElementCount === 0);


  console.groupEnd();
};
VNodeTest.elementChildTests();

VNodeTest.childNodesTests = function() {
  'use strict';
  console.group('Running childNodes tests');

  const parent = VNode.createElement('parent');
  parent.appendChild(VNode.createElement('c1'));
  parent.appendChild(VNode.createElement('c2'));
  parent.appendChild(VNode.createElement('c3'));

  const childNodes = parent.childNodes;
  console.log('Parent has childNodes?', !!childNodes);
  console.log('Parent has 3 children?', childNodes.length === 3);
  console.log('First child is c1?', childNodes[0].name === 'c1');
  console.log('Second child is c2?', childNodes[1].name === 'c2');
  console.log('Third child is c3?', childNodes[2].name === 'c3');

  // Write after read
  parent.appendChild(VNode.createElement('c4'));
  console.log('Still length 3 after adding 4th child?',
    childNodes.length === 3);
  parent.firstChild.remove();
  parent.firstChild.remove();
  console.log('Still length 3 after removing first and second child?',
    childNodes.length === 3);
  console.log('childNodes[0] is still c1?',
    childNodes[0].name === 'c1');

  console.groupEnd();
};
VNodeTest.childNodesTests();

VNodeTest.testAttributes = function() {
  'use strict';
  console.group('Running attribute tests');

  const node = VNode.createElement('node');

  console.log('getAttribute for no attributes is undefined?',
    !node.getAttribute('a'));
  console.log('hasAttribute for no attribuets is undefined?',
    !node.hasAttribute('b'));
  node.setAttribute('a', '1');
  console.log('setAttribute set an attribute?',
    node.getAttribute('a') === '1');
  node.setAttribute('a', '2');
  console.log('setAttribute on existing attribute overwrote?',
    node.getAttribute('a') === '2');
  node.removeAttribute('a');
  console.log('removeAttribute did remove?',
    !node.getAttribute('a'));

  const textNode = VNode.createTextNode('textNode');
  textNode.setAttribute('a', '1');
  console.log('setAttribute on textNode was ineffective?',
    !node.hasAttribute('a'));

  const idnode = VNode.createElement('idnode');
  idnode.setAttribute('id', 'test-id');
  console.log('node.id produces correct id value?',
    idnode.id === 'test-id');

  console.groupEnd();
};
VNodeTest.testAttributes();

VNodeTest.rootTests = function() {
  'use strict';
  console.group('Running root tests');

  const rootNode = VNode.createElement('rootNode');
  const child1 = VNode.createElement('child1');
  const grandChild = VNode.createTextNode('grandChild');
  rootNode.appendChild(child1);
  child1.appendChild(grandChild);

  console.log('Root node root is self?',
    rootNode.root === rootNode);
  console.log('Child root node is root?',
    child1.root === rootNode);
  console.log('Grand child root node is root?',
    grandChild.root === rootNode);

  grandChild.remove();
  console.log('Root changed after manipulation?',
    grandChild.root === grandChild);

  console.groupEnd();
};
VNodeTest.rootTests();

VNodeTest.traverseTests = function() {
  'use strict';
  console.group('Running traverse tests');

  const a = VNode.createElement('a');
  const b = VNode.createElement('b');
  const c = VNode.createElement('c');
  const d = VNode.createElement('d');
  const e = VNode.createElement('e');
  a.appendChild(b);
  a.appendChild(c);
  b.appendChild(d);
  c.appendChild(e);

  const nodes = [];
  a.traverse(function(n) {
    nodes.push(n.name);
  }, true);
  const descendants = [];
  a.traverse(function(n) {
    descendants.push(n.name);
  }, false);

  console.log('traverse worked?',
    nodes.join('') === 'abdce' && nodes.length === 5);
  console.log('traverse excluding self did exclude self?',
    descendants.indexOf('a') === -1);
  console.groupEnd();
};
VNodeTest.traverseTests();

VNodeTest.normalizeTests = function() {
  'use strict';
  console.group('Running normalize tests');

  const parent = VNode.createElement('parent');
  const t0 = VNode.createTextNode();
  const t1 = VNode.createTextNode('t1');
  const t2 = VNode.createTextNode('t2');
  const t3 = VNode.createTextNode('');
  const e0 = VNode.createElement('e0');
  const t4 = VNode.createTextNode('t4');
  const t5 = VNode.createTextNode('');
  parent.appendChild(t0);
  parent.appendChild(t1);
  parent.appendChild(t2);
  parent.appendChild(t3);
  parent.appendChild(e0)
  parent.appendChild(t4);
  parent.appendChild(t5);

  parent.normalize();

  console.log('After normalize, t1 value is correct?',
    t1.value === 't1t2');
  console.log('After normalize, t2 is detached?',
    !t2.parentNode && t1.nextSibling !== t2);
  console.log('After normalize, empty t3 is detached?',
    !t3.parentNode && t3.parentNode !== parent &&
    parent.lastChild !== t3);
  console.log('After normalize, parent has 3 child text nodes?',
    parent.childNodes.length === 3);
  console.log('After normalize, t4 has proper value?',
    t4.value === 't4');

  console.groupEnd();
};
VNodeTest.normalizeTests();

VNodeTest.searchTests = function() {
  'use strict';
  console.group('Running search tests');
  const a = VNode.createElement('a');
  const b = VNode.createElement('b');
  const c = VNode.createElement('c');
  a.appendChild(b);
  b.appendChild(c);
  const matchC = a.search(function(node) { return node.name === 'c'; });
  console.log('Search worked?', !!matchC && (matchC.name === 'c'));
  const noMatch = a.search(function(node) { return false;});
  console.log('Search failed as expected?', !noMatch);
  console.groupEnd();
};
VNodeTest.searchTests();

VNodeTest.testGetElementsByName = function() {
  'use strict';
  console.group('Running getElementsByName tests');
  const a = VNode.createElement('a');
  const b = VNode.createElement('b');
  const c1 = VNode.createElement('c');
  const c2 = VNode.createElement('c');
  const c3 = VNode.createElement('c');
  a.appendChild(b);
  b.appendChild(c1);
  b.appendChild(c2);
  b.appendChild(c3);
  const elements = a.getElementsByName('c', false);
  console.log('Matched 3 elements? ', elements.length === 3);
  console.groupEnd();
};
VNodeTest.testGetElementsByName();

VNodeTest.testGetElementById = function() {
  'use strict';
  console.group('Running getElementById tests');
  const parent = VNode.createElement('parent');
  const child = VNode.createElement('child');
  parent.appendChild(child);
  child.setAttribute('id', 'child-id');
  const match = parent.getElementById('child-id');
  console.log('Found child by id?', !!match && match.id === 'child-id'
    && match === child);

  const index = VNode.indexIds(parent);
  console.log('Found child in index?',
    !!index.get('child-id'));

  console.groupEnd();
};
VNodeTest.testGetElementById();

VNodeTest.testTableAccess = function() {
  'use strict';
  console.group('Testing table access');
  const table = VNode.createElement('table');
  const tbody = VNode.createElement('tbody');
  const r1 = VNode.createElement('tr');
  const r2 = VNode.createElement('tr');
  const r3 = VNode.createElement('tr');
  const r4 = VNode.createElement('tr');
  table.appendChild(r1);
  table.appendChild(tbody);
  table.appendChild(r2);
  tbody.appendChild(r3);
  tbody.appendChild(r4);
  const c1 = VNode.createElement('td');
  const c2 = VNode.createElement('td');
  r1.appendChild(c1);
  r1.appendChild(c2);
  console.log('Table has proper number of rows?',
    table.rows.length === 4);
  console.log('First row has expected number of columns?',
    table.rows[0].cols.length === 2);
  console.log('Second row has expected number of columns?',
    table.rows[1].cols.length === 0);
  console.log('Table has no cols property?',
    !table.cols);
  console.groupEnd();
};
VNodeTest.testTableAccess();

VNodeTest.testFromDOMNode = function() {
  'use strict';
  console.group('Testing fromDOMNode');

  const p = document.createElement('p');
  p.setAttribute('id', 'p');
  const vp = VNode.fromDOMNode(p);
  const t = document.createTextNode('test');
  const vt = VNode.fromDOMNode(t);

  console.log('Virtual node created?', !!vp);
  console.log('Element has correct type?', vp.type === Node.ELEMENT_NODE);
  console.log('Element has correct name?', vp.name === 'p');
  console.log('Element has correct attributes?',
    vp.getAttribute('id') === 'p');
  console.log('Text node has correct type?',
    vt.type === Node.TEXT_NODE);
  console.log('Text node has correct value?',
    vt.value === 'test');

  console.groupEnd();
};
VNodeTest.testFromDOMNode();

VNodeTest.testFromHTMLDocument = function() {
  'use strict';
  console.group('Running fromHTMLDocument tests');

  const doc = parseHTML('<html><head><title>Test</title></head><body>'+
  '<p id="first paragraph">Hello World!</p><a href="pathtonowhere.html">'+
  'This is an anchor</a><!-- A comment --></body></html>');

  const vdoc = VNode.fromHTMLDocument(doc);
  vdoc.normalize();
  const serialized = [];
  vdoc.traverse(function(node) {
    serialized.push(node.toString());
  }, true);
  console.log(doc.documentElement.outerHTML);
  console.log(serialized.join(''));

  console.groupEnd();
};
VNodeTest.testFromHTMLDocument();
