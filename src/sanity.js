// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Lib for cleaning up a document
// Requires: /src/dom.js
// Requires: /src/string.js

const sanity = {};

// TODO: rename to domaid.js and use domaid namespace object
// TODO: remove reliance on string.js
// TODO: remove reliance on dom.js
// TODO: remove reliance on notrack.js
// TODO: rename filterUnwrappables_complex to filterUnwrappablesExperimental

// TODO: research why some articles appear without content. I know pdfs
// work this way, but look into the issue with other ones.
// TODO: look into issues with rendering google groups pages.
// For example:
// view-source:https://groups.google.com/forum/#!topic/golang-nuts/MmSbFHLPo8g
// The content in the body after the <xmp>.<xmp> shows up as encoded? Maybe
// it is due to the single <plaintext/> tag preceding it? I can't tell what is
// going on. Does chrome's html parser screw up?
// TODO: explicit handling of noembed/audio/video/embed
// TODO: maybe I should have some other function
// that deals with malformed html and removes all nodes that do not conform
// to <html><head>*</head><body>*</body></html> and then none of the sanity
// functions need to be concerned.
// TODO: if I have no use for nodes outside of body, maybe it makes sense to
// just explicitly removal all such nodes.
// TODO: some things i want to maybe deal with at this url
// view-source:http://stevehanov.ca/blog/index.php?id=132
// It is using sprites. So transp is ignored. osrc is also ignored, i think it
// was macromedia dreamweaver rollover code that also just serves as a reminder
// of the desired original image source if rollover is disabled, and then
// the style points to the image embedded within a sprite.
// <img src="transparent.gif" osrc="kwijibo.png" style="background:
// url(sprite.jpg); background-position: 0px -5422px;width:270px;height:87px">
// I would have to modify a lot of things to support this. I would have to
// make sure urls appropriate resolved, that image not incorrectly removed,
// and i would have to partially retain style value.
// Another issue with that page is flow formatting, maybe I want to correct
// this or maybe I want to allow it, not sure. Specifically H1s within anchors

// TODO: there are quirks with malformed html. See this page
// http://blog.hackerrank.com/step-0-before-you-do-anything/
// It has an error with a noscript node. The guy forgot the < to start the
// nested script tag in it. So, part of its contents becomes a text node. This
// text node is somehow the first text node of the body in the DOM hierarchy
// represented to me in JS, even though it is not located within the body.
// Because it isn't filtered by the blacklist or anything, it shows up really
// awkwardly within the output as the first piece of body text.
// NOTE: filtering the nodes out of the body won't help.

// Applies a hardcoded series of filters to a document. Modifies the document
// in place.
sanity.cleanDocument = function(document) {
  sanity.filterComments(document);
  sanity.replaceFrames(document);
  sanity.filterNoscripts(document);
  sanity.filterBlacklistedElements(document);
  sanity.filterHiddenElements(document);
  sanity.replaceBreakRuleElements(document);
  sanity.filterAnchors(document);
  no_track_filter_tiny_images(document);
  sanity.filterImages(document);
  sanity.filterUnwrappables(document);
  sanity.filterFigureElements(document);
  sanity.condenseWhitespace(document);
  sanity.filterListElements(document);
  sanity.filterTableElements(document);
  sanity.filterLeafElements(document);
  sanity.filterConsecutiveHRElements(document);
  sanity.filterConsecutiveBRElements(document);
  sanity.trimDocument(document);
  sanity.filterAttributes(document);
};

// NOTE: we cannot remove noscript elements because some sites embed the
// article within a noscript tag. So instead we treat noscripts as unwrappable
// Because noscripts are a special case for now I am not simply adding noscript
// to sanity-unwrap
// We still have to unwrap. If noscript remains, the content remains within the
// document, but it isn't visible/rendered because we obviously support scripts
// and so the browser hides it. So now we have to remove it.
sanity.filterNoscripts = function(document) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const noscripts = bodyElement.querySelectorAll('noscript');
  const numNoscripts = noscripts.length;

  for(let i = 0; i < numNoscripts; i++) {
    dom_unwrap(noscripts[i], null);
  }
};

sanity.filterComments = function(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let comment = it.nextNode(); comment; comment = it.nextNode()) {
    comment.remove();
  }
};


// TODO: what if both body and frameset are present?
// TODO: there can be multiple bodies when illformed. Maybe use
// querySelectorAll and handle multi-body branch differently
sanity.replaceFrames = function(document) {
  const framesetElement = document.body;
  if(!framesetElement || framesetElement.nodeName !== 'FRAMESET') {
    return;
  }

  const bodyElement = document.createElement('BODY');
  const noframes = document.querySelector('NOFRAMES');
  if(noframes) {
    for(let node = noframes.firstChild; node; node = noframes.firstChild) {
      bodyElement.appendChild(node);
    }
  } else {
    const errorTextNode = document.createTextNode(
      'Unable to display framed document.');
    bodyElement.appendChild(errorTextNode);
  }

  framesetElement.remove();
  document.documentElement.appendChild(bodyElement);
};

sanity.filterAnchors = function(document) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  // This looks for anchors that contain inline script. I tested using
  // anchor.protocol === 'javascript:' and found that it was subtantially
  // slower than using a RegExp.

  const anchors = bodyElement.querySelectorAll('A');
  const numAnchors = anchors.length;
  const JS_PATTERN = /^\s*JAVASCRIPT\s*:/i;
  const MIN_HREF_LEN = 'JAVASCRIPT:'.length;

  // NOTE: hasAttribute is true for empty attribute values, but I am not
  // concerned with this at the moment.

  for(let i = 0, anchor, href; i < anchors; i++) {
    anchor = anchors[i];
    if(anchor.hasAttribute('href')) {
      href = anchor.getAttribute('href');
      // Neutralize javascript anchors
      if(href.length > MIN_HREF_LEN && JS_PATTERN.test(href)) {
        // NOTE: consider removing or unwrapping
        anchor.setAttribute('href', '');
      }
    } else if(!anchor.hasAttribute('name')) {
      // Without a name and href this is just a formatting
      // anchor so unwrap it.
      dom_unwrap(anchor);
    }
  }
};

// Unwrap lists with only one item.
sanity.filterListElements = function(document) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const ITEM_ELEMENT_NAMES = {'LI': 1, 'DT': 1, 'DD': 1};

  const listNodeList = bodyElement.querySelectorAll('UL, OL, DL');
  const nodeListLength = listNodeList.length;
  for(let i = 0, listElement, itemElement; i < nodeListLength; i++) {
    listElement = listNodeList[i];
    if(listElement.childElementCount === 1) {
      itemElement = listElement.firstElementChild;
      if(itemElement.nodeName in ITEM_ELEMENT_NAMES) {
        listElement.parentNode.insertBefore(document.createTextNode(' '),
          listElement);
        dom_insert_children_before(itemElement, listElement);
        listElement.parentNode.insertBefore(document.createTextNode(' '),
          listElement);
        listElement.remove();
      }
    }
  }
};

sanity.filterConsecutiveHRElements = function(document) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const elements = bodyElement.querySelectorAll('HR');
  const numElements = elements.length;

  for(let i = 0, rule, prev; i < numElements; i++) {
    prev = elements[i].previousSibling;
    if(prev && prev.nodeName === 'HR') {
      prev.remove();
    }
  }
};

sanity.filterConsecutiveBRElements = function(document) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const elements = bodyElement.querySelectorAll('BR');
  const numElements = elements.length;

  for(let i = 0, prev; i < numElements; i++) {
    prev = elements[i].previousSibling;
    if(prev && prev.nodeName === 'BR') {
      prev.remove();
    }
  }
};

// TODO: improve, this is very buggy
// error case: http://paulgraham.com/procrastination.html
sanity.replaceBreakRuleElements = function(document) {

  // NOTE: Due to buggy output this is a NOOP for now
  if(true) {
    return;
  }

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const nodeList = bodyElement.querySelectorAll('BR');
  const listLength = nodeList.length;

  for(let i = 0, brElement, parent, p; i < listLength; i++) {
    brElement = nodeList[i];

    brElement.renameNode('p');

    //parent = brElement.parentNode;
    //p = document.createElement('P');
    //parent.replaceChild(p, brElement);
  }
};

// If a figure has only one child element image, then it is useless.
// NOTE: boilerplate analysis examines figures, so ensure this is not done
// before it.
sanity.filterFigureElements = function(document) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const figures = bodyElement.querySelectorAll('FIGURE');
  const numFigures = figures.length;
  for(let i = 0, figure; i < numFigures; i++) {
    figure = figures[i];
    if(figure.childElementCount === 1) {
      // console.debug('Unwrapping basic figure:', figure.outerHTML);
      dom_unwrap(figure, null);
    }
  }
};

// Removes most attributes from elements using a per element whitelist
// TODO: make less dry, maybe add helpers
// TODO: removeAttribute just does a lookup of the attribute again. Look
// into whether there is a simple way to remove an attribute if I already
// have the attribute node object.
// NOTE: This applies to all elements, not just those within body. This
// is intentional because we have to consider everything.
sanity.filterAttributes = function(document) {
  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;

  // Iterate attributes in reverse to avoid issues with mutating a live
  // NodeList during iteration
  let elementName = null;
  let attributeName = null;
  let element = null;
  let attributes = null;
  let j = 0;

  for(let i = 0; i < numElements; i++) {
    element = elements[i];
    elementName = element.nodeName;
    attributes = element.attributes;
    if(!attributes || !attributes.length) {
      continue;
    }

    if(elementName === 'SOURCE') {
      for(j = attributes.length - 1; j > -1; j--) {
        attributeName = attributes[j].name;
        if(attributeName !== 'type' && attributeName !== 'srcset' &&
          attributeName !== 'sizes' && attributeName !== 'media' &&
          attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'A') {
      for(j = attributes.length - 1; j > -1; j--) {
        attributeName = attributes[j].name;
        if(attributeName !== 'href' && attributeName !== 'name' &&
          attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'IFRAME') {
      for(j = attributes.length - 1; j > -1; j--) {
        attributeName = attributes[j].name;
        if(attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'IMG') {
      for(j = attributes.length - 1; j > -1; j--) {
        attributeName = attributes[j].name;
        if(attributeName !== 'src' && attributeName !== 'alt' &&
          attributeName !== 'srcset' && attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else {
      for(j = attributes.length - 1; j > -1; j--) {
        element.removeAttribute(attributes[j].name);
      }
    }
  }
};

// Lib for removing blacklisted elements. This fulfills multiple purposes.
// Certain blacklisted elements are unwrapped instead of removed and that
// is handled by other sanity functionality.

sanity.BLACKLISTED_ELEMENT_NAMES = [
  'APPLET', 'AUDIO', 'BASE', 'BASEFONT', 'BGSOUND', 'BUTTON', 'COMMAND',
  'DATALIST', 'DIALOG', 'EMBED', 'FIELDSET', 'FRAME', 'FRAMESET', 'HEAD',
  'IFRAME', 'INPUT', 'ISINDEX', 'LINK', 'MATH', 'META',
  'OBJECT', 'OUTPUT', 'OPTGROUP', 'OPTION', 'PARAM', 'PATH', 'PROGRESS',
  'SCRIPT', 'SELECT', 'SPACER', 'STYLE', 'SVG', 'TEXTAREA', 'TITLE',
  'VIDEO', 'XMP'
];

sanity.BLACKLIST_SELECTOR = sanity.BLACKLISTED_ELEMENT_NAMES.join(',');

// Removes blacklisted elements from the document.
// This uses a blacklist approach instead of a whitelist because of issues
// with custom html elements. If I used a whitelist approach, any element
// not in the whitelist would be removed. The problem is that custom elements
// wouldn't be in the whitelist, but they easily contain valuable content.
sanity.filterBlacklistedElements = function(document) {
  const docElement = document.documentElement;
  const elements = document.querySelectorAll(sanity.BLACKLIST_SELECTOR);
  const numElements = elements.length;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(docElement.contains(element)) {
      element.remove();
    }
  }
};

// NOTE: this only sanitizes text nodes within the body element.
// TODO: delete all text nodes outside of the body?
sanity.condenseWhitespace = function(document) {

  // NOTE: node.nodeValue yields a decoded value without entities, not the
  // raw encoded value that contains entities.
  // NOTE: node.nodeValue is guaranteed defined, otherwises the text node
  // would not exist.

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  // The whitespace of text nodes within these elements is important.
  const SENSITIVE_ELEMENTS = ['CODE', 'PRE', 'RUBY', 'TEXTAREA', 'XMP'];
  const SENSITIVE_SELECTOR = SENSITIVE_ELEMENTS.join(',');

  const iterator = document.createNodeIterator(bodyElement,
    NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(), value, condensedValue; node;
    node = iterator.nextNode()) {
    value = node.nodeValue;

    // The length check minimizes the number of calls to closest and the
    // regexp, which are costly.
    if(value.length > 3) {
      // Check if the current text node is a descendant of a whitespace
      // sensitive element.
      if(!node.parentNode.closest(SENSITIVE_SELECTOR)) {
        // Condense consecutive spaces
        condensedValue = value.replace(/\s{2,}/g, ' ');

        // We only bother to set nodeValue if we changed it. Setting nodeValue
        // is actually a pretty costly operation that involves parsing entities
        // and such, so avoid it if possible.
        if(condensedValue !== value) {
          // NOTE: the value will be re-encoded automatically for us.
          node.nodeValue = condensedValue;
        }
      }
    }
  }
};

// Currently this only removes img elements without a source.
// Images may be removed by other components like in notrack.js
sanity.filterImages = function(document) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const imageNodeList = bodyElement.querySelectorAll('IMG');
  const listLength = imageNodeList.length;
  for(let i = 0, imageElement; i < listLength; i++) {
    imageElement = imageNodeList[i];
    if(!imageElement.hasAttribute('src') &&
      !imageElement.hasAttribute('srcset')) {
      imageElement.remove();
    }
  }
};

// Removes leaf-like elements from the document. An element is a leaf unless
// it is a named exception, contains a non-whitespace-only text node, or
// contains at least one non-leaf child element.
// Because DOM modification is expensive, this tries to minimize the number
// of elements removed by only removing the shallowest elements. For example,
// when processing <outerleaf><innerleaf></innerleaf></outerleaf>, the naive
// approach would perform two operations, first removing the innerleaf and
// then the outerleaf. The outerleaf is also a leaf because upon removing the
// innerleaf, it then satisfies the is-leaf condition. Instead, this recognizes
// this situation, and only removes outerleaf. The cost of doing this is
// that the is-leaf function is recursive. However, this cost is supposedly
// less than the cost of removing every leaf.
// This still iterates over all of the elements, because using querySelectorAll
// is faster than walking. As a result, this also checks at each step of the
// iteration whether the current element is still attached to the document, and
// avoids removing elements that were detached by virtue of an ancestor being
// detached in a prior iteration step.
sanity.filterLeafElements = function(document) {
  // A document element is required.
  const docElement = document.documentElement;

  // TODO: is this check even needed?
  if(!docElement) {
    return;
  }

  // TODO: maybe I do not need docElement. Maybe just checking if
  // bodyElement contains is sufficient.

  // A body element is required.
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  // Only iterate elements within the body element. This prevents the body
  // element itself and the document element from also being iterated and
  // therefore identified as leaves and therefore removed in the case of an
  // empty document.
  // docElement.contains(docElement) returns true because docElement
  // is an inclusive descendant of docElement as defined in the spec. This is
  // why docElement itself can also be removed if this iterated over all
  // elements and not just those within the body.

  const elements = bodyElement.querySelectorAll('*');
  const numElements = elements.length;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(docElement.contains(element) && sanity.isLeafNode(element)) {
      element.remove();
    }
  }
};

// These elements are never considered leaves, regardless of other criteria.
// In general, these elements correspond to 'void' elements that generally
// cannot contain child elements.
// In an HTML document context, element.nodeName is always uppercase
// I am using a plain old object instead of a Set because profiling showed
// poor performance.
// TODO: because I just check for existence, look into storing null or whatever
// is the smallest value. Also look into the new ES6 style of object literal
// declaration
sanity.LEAF_EXCEPTIONS = {
  'AREA': 1, 'AUDIO': 1, 'BASE': 1, 'COL': 1, 'COMMAND': 1, 'BR': 1,
  'CANVAS': 1, 'COL': 1, 'HR': 1, 'IFRAME': 1, 'IMG': 1, 'INPUT': 1,
  'KEYGEN': 1, 'META': 1, 'NOBR': 1, 'PARAM': 1, 'PATH': 1, 'SOURCE': 1,
  'SBG': 1, 'TEXTAREA': 1, 'TRACK': 1, 'VIDEO': 1, 'WBR': 1
};

// Returns whether the given node is a leaf. Recursive.
sanity.isLeafNode = function(node) {
  if(node.nodeType === Node.ELEMENT_NODE) {
    if(node.nodeName in sanity.LEAF_EXCEPTIONS) {
      return false;
    }

    // Recur on child nodes. If any child node is not a leaf, then this
    // element is not a leaf. Breaks upon the first non-leaf. If no children
    // or no child non-leaves found, fall through to the return true at the
    // the bottom.
    for(let child = node.firstChild; child; child = child.nextSibling) {
      if(!sanity.isLeafNode(child)) {
        return false;
      }
    }

  } else if(node.nodeType === Node.TEXT_NODE) {

    // TODO: one idea of an alternate condition that may be faster is to
    // simply look for the presence of a non-whitespace character.

    return !node.nodeValue.trim();
  } else {
    // Never consider an unknown node type to be a leaf, and prevent
    // ancestors of this node from being leaves
    return false;
  }

  return true;
};

// Unwraps single column and single cell tables
sanity.filterTableElements = function(document) {
  // TODO: restrict to document.body
  const tables = document.querySelectorAll('TABLE');
  const tableLength = tables.length;

  let rows = null;
  let cells = null;
  let cell = null;
  let table = null;
  let rowLength = 0;

  for(let i = 0; i < tableLength; i++) {
    table = tables[i];
    rows = table.rows;
    rowLength = rows.length;

    if(rowLength === 1) {
      cells = rows[0].cells;
      if(cells.length === 1) {
        sanity.unwrapSingleCellTable(table);
        continue;
      }
    }

    if(sanity.isSingleColumnTable(table)) {
      sanity.unwrapSingleColumnTable(table);
    }
  }
};

// TODO: allow for empty rows?
sanity.unwrapSingleCellTable = function(table) {
  const cell = table.rows[0].cells[0];
  const document = table.ownerDocument;
  const tableParent = table.parentNode;
  tableParent.insertBefore(document.createTextNode(' '), table);
  dom_insert_children_before(cell, table);
  tableParent.insertBefore(document.createTextNode(' '), table);
  table.remove();
};

// Examines the first 50 rows of a table element and decides whether
// the table is probably a simple single column table
sanity.isSingleColumnTable = function(table) {
  const rows = table.rows;
  const rowLength = rows.length;
  const upperBound = Math.min(rowLength, 50);
  for(let i = 0; i < upperBound; i++) {
    if(rows[i].cells.length > 1) {
      return false;
    }
  }

  return true;
};

sanity.unwrapSingleColumnTable = function(table) {
  const document = table.ownerDocument;
  const tableParent = table.parentNode;
  const rows = table.rows;
  const rowLength = rows.length;

  tableParent.insertBefore(document.createTextNode(' '), table);
  for(let rowIndex = 0, colIndex = 0, cells; rowIndex < rowLength;
    rowIndex++) {
    cells = rows[rowIndex];
    for(colIndex = 0; colIndex < cells.length; colIndex++) {
      dom_insert_children_before(cells[colIndex], table);
    }
    tableParent.insertBefore(document.createElement('P'), table);
  }
  tableParent.insertBefore(document.createTextNode(' '), table);
  table.remove();
};

// Remove trimmable nodes from the start and end of the document.
sanity.trimDocument = function(document) {
  // Restrict the scope of the descendants of body
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const firstChild = bodyElement.firstChild;
  if(firstChild) {
    sanity.removeTrimmableNodesByStep(firstChild, 'nextSibling');

    // Now start from the last child. This block is nested here because there
    // could only possibly be a last child if there was a first.
    // Although having a first child indicates that lastChild would be defined,
    // the body may have been emptied, so we still need to check again. The
    // second check if last is different is just a theoretical optimization
    // because it avoids the function call in the simple case.
    const lastChild = bodyElement.lastChild;
    if(lastChild && lastChild !== firstChild) {
      sanity.removeTrimmableNodesByStep(bodyElement.lastChild,
        'previousSibling');
    }
  }
};

// A set of element node names that are considered trimmable. This generally
// corresponds to VOID nodes as defined in the spec. However, not all void
// nodes are analogous to whitespace.
sanity.TRIMMABLE_VOID_ELEMENT_NAMES = {
  'BR': 1,
  'HR': 1,
  'NOBR': 1
};

// Walk in the step direction removing trimmable nodes. May include the start
// node if it is trimmable.
// TODO: seems like duplication or something of a similar issue with filtering
// leaves in leaf.js. Are the operations are associative?
sanity.removeTrimmableNodesByStep = function(startNode, step) {
  // A node is trimmable when it is:
  // 1) A named element
  // 2) A whitespace only or empty text node

  // Caching the constant so that it does not do a property lookup per each
  // loop iteration. I am not sure if this matters.
  const TEXT = Node.TEXT_NODE;

  // We could use startNode itself as a mutable variable, but I prefer never to
  // write to a parameter.
  let node = startNode;

  // This could be initialized to null, but I init to the variable type with
  // the hope that it gives a hint to the interpreter.
  let sibling = startNode;

  // TODO: I think this loop can be simplified. I don't like having a complex
  // condition in the loop head.

  while(node && (node.nodeName in sanity.TRIMMABLE_VOID_ELEMENT_NAMES ||
    (node.nodeType === TEXT && !node.nodeValue.trim()))) {
    sibling = node[step];
    node.remove();
    node = sibling;
  }
};


/*
Provides basic unwrap function and a sanitize html function that unwraps
various elements. To unwrap an element means to replace the element with
its children, effectively removing the element.

When ignoring most of the attributes of an element, and removing most
styling information, several elements become meaningless wrappers of other
elements, and therefore extraneous. Removing the extraneous elements helps
compress the size of the document, which reduces storage, and speeds up
traversal.

Unwrap introduces sentinel text nodes because unwrapping an element
can result in adjacent text. For example, <p>a<inline>b<inline></p>
can result in rendering ab. With the inline, the browser would implicitly
generate a space to separate the text.

Unwrap is not optimized for live document modification. It is designed
to work on an inert document such as one generated by XMLHttpRequest or
document.implementation.createHTMLDocument. An earlier implementation
removed the parent of the node entirely before moving each of the child
nodes individually, and then re-attached the parent. For some unclear reason
this is slow, so I did away with the parent manipulation.

TODO: I am focusing on optimizing this function. It is primarily called by
sanitizeDocument, and profiling shows that it is usually the slowest part of
that function. The primary performance seems to be that unwrap is slow, because
unwrap makes several calls to insertBefore.

I have not found a way to efficiently move a node's child nodes using a single
operation. The closest I got was using
parentNode.insertAdjacentHTML(childNode.innerHTML, childNode). Profiling showed
this was slower than moving individual nodes with insertBefore. I suppose this
is due to all the marshalling, and the implicit XSS checks and all that. I am
still looking for some way to do a batch op.

I also experimented with recreation of an entire virtual dom. I made it as
efficient as possible. It turns out to be terribly slow.

Therefore, instead of optimizing unwrap, I am trying to reduce the number of
calls to unwrap. There are several situations where this is possible:

<p><inline><inline>text</inline></inline></p>
<p><inline>whitespace<inline>text</inline>whitespace</p>
<p><inline><inline>text</inline><inline>text</inline></inline></p>

So far I have two implementations, a naive version that unwraps everything, and
a crappy more complex version that attempts to reduce the number of calls.
Unfortunately, the naive is still currently better performance. I think part of
the problem is that the attempt doubles some of its logic, and involves
recursion. For example, I am seeing in a profile that I drop the total time
spent calling unwrap, because of the reduced number of calls, but the overhead
of the filterUnwrappables function itself increases.

Another problem is due to the recently added support for detecting nesting
of multiple inlines. For example, situation 3 above. I can now detect the
nesting here,
but now the call to unwrap with a 2nd argument works incorrectly. When it
unwraps inline2 into p, it detaches inline2. However, it also detaches
inline1 because that implicitly detaches inline2. And that is the source of
the problem, because detaching inline1 implicitly detaches inline3, when
inline3 should in fact still exist at that point. I am still working this
out. Another thought is that maybe this isn't a problem. inline3 is still
yet to be visited in the iteration of unwrapple elements. It will eventually
be visited, and it will still have a parent. The problem is that the parent
at that point is no longer attached.

I do not like that sanity.isUnwrappableParent makes a call to match. It feels
somehow redundant. match is also slow. one idea is to keep a set (or basic
array) of the inline elements initially found, and just check set membership
instead of calling matches

I do not like how I am calling sanity.isUnwrappableParent multiple times.
First
in the iteration in order to skip, and second when finding the shallowest
ancestor.

I do not like how I am repeatedly trimming several text nodes. This feels
sluggish.
*/

sanity.UNWRAPPABLE_SELECTOR = [
  'ABBR', 'ACRONYM', 'ARTICLE', 'ASIDE', 'CENTER', 'COLGROUP', 'DATA',
  'DETAILS', 'DIV', 'FOOTER', 'HEADER', 'HELP', 'HGROUP', 'ILAYER',
  'INSERT', 'LAYER', 'LEGEND', 'MAIN', 'MARK', 'MARQUEE', 'METER',
  'MULTICOL', 'NOBR', 'SECTION', 'SPAN', 'TBODY', 'TFOOT', 'THEAD', 'FORM',
  'LABEL', 'BIG', 'BLINK', 'FONT', 'PLAINTEXT', 'SMALL', 'TT'
].join(',');

sanity.filterUnwrappables = function(document) {
  return sanity.filterUnwrappables_naive(document);
};

sanity.filterUnwrappables_naive = function(document) {
  // Require body. Only examine elements beneath body.
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const elements = bodyElement.querySelectorAll(sanity.UNWRAPPABLE_SELECTOR);
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    dom_unwrap(elements[i], null);
  }
};

sanity.filterUnwrappables_complex = function(document) {
  const elements = document.querySelectorAll(sanity.UNWRAPPABLE_SELECTOR);
  for(let i = 0, len = elements.length, element, shallowest; i < len; i++) {
    element = elements[i];
    if(!sanity.isUnwrappableParent(element)) {
      shallowest = sanity.findShallowestUnwrappableAncestor(element);
      dom_unwrap(element, shallowest);
    }
  }
}

sanity.isUnwrappableParent = function(element) {
  let result = element.matches(sanity.UNWRAPPABLE_SELECTOR);
  for(let node = element.firstChild; result && node; node = node.nextSibling) {
    if(node.nodeType === Node.ELEMENT_NODE) {
      if(!sanity.isUnwrappableParent(node)) {
        result = false;
      }
    } else if(node.nodeType === Node.TEXT_NODE) {
      if(node.nodeValue.trim()) {
        result = false;
      }
    }
  }

  return result;
};

// TODO: do not iterate past body
sanity.findShallowestUnwrappableAncestor = function(element) {
  let shallowest = null;
  for(let node = element.parentNode;
    node && sanity.isUnwrappableParent(node);
    node = node.parentNode) {

    shallowest = node;
  }
  return shallowest;
};

// Sanity helper functions for dealing with hidden elements.
// Filters hidden elements from a document. This originally was more accurate
// because it checked computed style. However that turned out to be terribly
// slow. So instead, this uses a gimmick with query selectors to look for
// inline elements. This does not consider styles from linked css files as
// those are removed anyway. I might consider writing a document preprocessor
// that inlines all styles. As a result of the gimmick, it is less accurate
// but it is much faster.
// I cannot use the offsetWidth/offsetHeight tricks like how jQuery does
// this because that trick only works for live documents. This is designed
// to work with an inert document such as one produceed by
// XMLHttpRequest.responseXML or DOMParser or
// document.implementation.createHTMLDocument. offsetWidth and offsetHeight
// are 0 for all elements in an inert document.
// This originally removed elements. Now it just unwraps. This helps avoid
// an issue with documents that wrap all content in a hidden element and then
// dynamically unhide the element. For example:
// view-source:http://stevehanov.ca/blog/index.php?id=132. This pages uses
// a main div with inline visibility hidden, and then uses an inline script
// at the bottom of the page that sets the visibility to visible. I also
// think this is a document produced by Macromedia Dreamweaver, so I think
// this is not a one-time thing.
// I have mixed feelings about unwrapping hidden content. There is an ambiguity
// regarding whether the content is useful. It is either content subject to the
// un-hide trick, or it is content that is intentionally hidden for some
// unknown reason by the author. It does not happen very often anymore but
// some authors hide content maliciously to fool search engines or simply
// because it is remnant of drafting the page, or because it is auxillary
// stuff, or because it is part of some scripted component of the page.
// TODO: now that this unwraps, do additional testing to see if unwrapped
// content appears. Maybe a middle ground is to remove if removing does not
// leave an empty body. As in, if the parent is body, unwrap, otherwise
// remove.
// TODO: support aria hidden ?
// https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden

sanity.filterHiddenElements = function(document) {
  // Document element is required.
  // TODO: maybe i do not need docElement, maybe
  // checking bodyElement.contains is sufficient.
  // Also, when would a document ever not have a documentElement? It seems
  // like this should be a runtime error that I do not catch. In other words
  // this is overly-defensive.
  const docElement = document.documentElement;
  if(!docElement) {
    return;
  }

  // Body is required.
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const HIDDEN_SELECTOR = [
    '[style*="display:none"]',
    '[style*="display: none"]',
    '[style*="visibility:hidden"]',
    '[style*="visibility: hidden"]',
    '[style*="opacity:0.0"]'
  ].join(',');

  // Removing nodes that reside in a node already removed is harmless. However,
  // it is a wasted operation, and dom operations are generally expensive.
  // This checks 'contains' so as to avoid removing elements that were already
  // removed in a prior iteration. Nodes are walked in document order
  // because that is how querySelectorAll produces its NodeList content.
  // Therefore descendants are visisted after ancestors. Therefore it is
  // possible to iterate over descendants that reside in an ancestor that was
  // already removed.
  // I would prefer to not even visit such descendants. I suppose I could
  // use a TreeWalker. However, I have found that tree walking is very slow
  // in comparison to querySelectorAll and contains. However, I have not
  // tested this in a while so maybe it is worth it to experiment again.
  // Select from within body so as to exclude documentElement and body from
  // the set of elements analyzed. This is important because it prevents
  // the chance that the body and document element are removed.

  const elements = bodyElement.querySelectorAll(HIDDEN_SELECTOR);
  const numElements = elements.length;

  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(docElement.contains(element)) {
      dom_unwrap(element);
    }
  }
};
