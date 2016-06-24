// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Routines for cleaning up nodes in an HTMLDocument
const DOMAid = Object.create(null);

// Applies a series of filters to a document. Modifies the document
// in place. The filters are applied in a preset order so as to minimize the
// work done by each sequential step, and to ensure proper handling of
// things like frameset elements.
DOMAid.cleanDocument = function(document) {
  DOMAid.filterComments(document);
  DOMAid.replaceFrames(document);
  DOMAid.filterNoscripts(document);
  DOMAid.filterBlacklistedElements(document);
  filterHiddenElements(document);
  DOMAid.replaceBreakRuleElements(document);
  DOMAid.filterAnchors(document);
  DOMAid.filterTinyImages(document);
  DOMAid.filterImages(document);
  filterUnwrappableElements(document);
  DOMAid.filterFigureElements(document);
  condenseTextNodeWhitespace(document);
  DOMAid.filterListElements(document);
  DOMAid.filterTableElements(document);
  filterLeafElements(document);
  DOMAid.filterConsecutiveHRElements(document);

  // TODO: deprecate once replaceBreakRuleElements is fixed
  DOMAid.filterConsecutiveBRElements(document);
  trimDocument(document);
  DOMAid.filterAttributes(document);
};


// Unwraps <noscript> elements. Although this could be done by
// filterUnwrappables, I am doing it here because I consider <noscript> to be
// a special case. This unwraps instead of removes because some documents
// embed the entire content in a noscript tag and then use their own scripted
// unwrapping call to make the content available.
//
// TODO: look into whether I can make a more educated guess about whether
// to unwrap or to remove. For example, maybe if there is only one noscript
// tag found, or if the number of elements outside of the node script but
// within the body is above or below some threshold (which may need to be
// relative to the total number of elements within the body?)
DOMAid.filterNoscripts = function(document) {
  const elementNodeList = document.querySelectorAll('noscript');
  const nullReferenceNode = null;
  for(let element of elementNodeList) {
    unwrapElement(element, nullReferenceNode);
  }
};

DOMAid.filterComments = function(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let comment = it.nextNode(); comment; comment = it.nextNode()) {
    comment.remove();
  }
};

// TODO: what if both body and frameset are present?
// TODO: there can be multiple bodies when illformed. Maybe use
// querySelectorAll and handle multi-body branch differently
DOMAid.replaceFrames = function(document) {
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

// Assumes anchorElement is defined.
DOMAid.isJavascriptAnchor = function(anchorElement) {
  // NOTE: the call to getAttribute is now the slowest part of this function,
  // it is even slower than the regex
  // NOTE: accessing anchor.href is noticeably slower
  // NOTE: accessing anchor.protocol is noticeably slower
  // The length check reduces the number of calls to the regexp because of
  // short circuited evaluation
  // TODO: check whether Chrome lets through other types of inline script
  // like this
  const JS_PATTERN = /^\s*JAVASCRIPT\s*:/i;
  const MIN_HREF_LEN = 'JAVASCRIPT:'.length;
  const href = anchorElement.getAttribute('href');
  return href && href.length > MIN_HREF_LEN && JS_PATTERN.test(href);
};

// An anchor is a formatting anchor when it serves no other role than being a
// container. In this context, where formatting information is ignored, it is
// useless.
DOMAid.isFormattingAnchor = function(anchorElement) {
  return !anchorElement.hasAttribute('href') &&
    !anchorElement.hasAttribute('name');
};

// Transform anchors that contain inline script or only serve a formatting role
DOMAid.filterAnchors = function(document) {
  const anchorNodeList = document.querySelectorAll('a');
  for(let anchor of anchorNodeList) {
    if(DOMAid.isFormattingAnchor(anchor) ||
      DOMAid.isJavascriptAnchor(anchor)) {
      unwrapElement(anchor);
    }
  }
};

// Unwrap lists with only one item.
DOMAid.filterListElements = function(document) {
  const ITEM_ELEMENT_NAMES = {'LI': 1, 'DT': 1, 'DD': 1};
  const listNodeList = document.querySelectorAll('UL, OL, DL');
  for(let listElement of listNodeList) {
    if(listElement.childElementCount === 1) {
      let itemElement = listElement.firstElementChild;
      if(itemElement.nodeName in ITEM_ELEMENT_NAMES) {
        listElement.parentNode.insertBefore(document.createTextNode(' '),
          listElement);
        insertChildrenBefore(itemElement, listElement);
        listElement.parentNode.insertBefore(document.createTextNode(' '),
          listElement);
        listElement.remove();
      }
    }
  }
};

DOMAid.filterConsecutiveHRElements = function(document) {
  const elements = document.querySelectorAll('HR');
  for(let element of elements) {
    let prev = element.previousSibling;
    if(prev && prev.nodeName === 'HR') {
      prev.remove();
    }
  }
};

DOMAid.filterConsecutiveBRElements = function(document) {
  const elements = document.querySelectorAll('BR');
  for(let element of elements) {
    let prev = element.previousSibling;
    if(prev && prev.nodeName === 'BR') {
      prev.remove();
    }
  }
};

// TODO: improve, this is very buggy
// error case: http://paulgraham.com/procrastination.html
DOMAid.replaceBreakRuleElements = function(document) {

  // NOTE: Due to buggy output this is a NOOP for now
  if(true) {
    return;
  }

  const nodeList = document.querySelectorAll('BR');
  for(let brElement of nodeList) {
    brElement.renameNode('p');

    //parent = brElement.parentNode;
    //p = document.createElement('P');
    //parent.replaceChild(p, brElement);
  }
};

// If a figure has only one child element image, then it is useless.
// NOTE: boilerplate analysis examines figures, so ensure this is not done
// before it.
DOMAid.filterFigureElements = function(document) {
  const figures = document.querySelectorAll('FIGURE');
  for(let figure of figures) {
    if(figure.childElementCount === 1) {
      unwrapElement(figure, null);
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
DOMAid.filterAttributes = function(document) {
  const elements = document.getElementsByTagName('*');

  // Iterate attributes in reverse to avoid issues with mutating a live
  // NodeList during iteration
  for(let element of elements) {
    let elementName = element.nodeName;
    let attributes = element.attributes;
    if(!attributes || !attributes.length) {
      continue;
    }

    if(elementName === 'SOURCE') {
      for(let j = attributes.length - 1; j > -1; j--) {
        let attributeName = attributes[j].name;
        if(attributeName !== 'type' && attributeName !== 'srcset' &&
          attributeName !== 'sizes' && attributeName !== 'media' &&
          attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'A') {
      for(let j = attributes.length - 1; j > -1; j--) {
        let attributeName = attributes[j].name;
        if(attributeName !== 'href' && attributeName !== 'name' &&
          attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'IFRAME') {
      for(let j = attributes.length - 1; j > -1; j--) {
        let attributeName = attributes[j].name;
        if(attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'IMG') {
      for(let j = attributes.length - 1; j > -1; j--) {
        let attributeName = attributes[j].name;
        if(attributeName !== 'src' && attributeName !== 'alt' &&
          attributeName !== 'srcset' && attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else {
      for(let j = attributes.length - 1; j > -1; j--) {
        element.removeAttribute(attributes[j].name);
      }
    }
  }
};

// Certain blacklisted elements are unwrapped instead of removed and that
// is handled by other sanity functionality.
DOMAid.BLACKLISTED_ELEMENT_NAMES = [
  'APPLET', 'AUDIO', 'BASE', 'BASEFONT', 'BGSOUND', 'BUTTON', 'COMMAND',
  'DATALIST', 'DIALOG', 'EMBED', 'FIELDSET', 'FRAME', 'FRAMESET', 'HEAD',
  'IFRAME', 'INPUT', 'ISINDEX', 'LINK', 'MATH', 'META',
  'OBJECT', 'OUTPUT', 'OPTGROUP', 'OPTION', 'PARAM', 'PATH', 'PROGRESS',
  'SCRIPT', 'SELECT', 'SPACER', 'STYLE', 'SVG', 'TEXTAREA', 'TITLE',
  'VIDEO', 'XMP'
];
DOMAid.BLACKLIST_SELECTOR = DOMAid.BLACKLISTED_ELEMENT_NAMES.join(',');

// Removes blacklisted elements from the document.
// This uses a blacklist approach instead of a whitelist because of issues
// with custom html elements. If I used a whitelist approach, any element
// not in the whitelist would be removed. The problem is that custom elements
// wouldn't be in the whitelist, but they easily contain valuable content.
DOMAid.filterBlacklistedElements = function(document) {
  const docElement = document.documentElement;
  const elements = document.querySelectorAll(DOMAid.BLACKLIST_SELECTOR);
  for(let element of elements) {
    if(docElement.contains(element)) {
      element.remove();
    }
  }
};

// Currently this only removes img elements without a source.
// Images may be removed by other functions
DOMAid.filterImages = function(document) {
  const imageNodeList = document.querySelectorAll('img');
  for(let imageElement of imageNodeList) {
    if(!imageElement.hasAttribute('src') &&
      !imageElement.hasAttribute('srcset')) {
      imageElement.remove();
    }
  }
};

DOMAid.filterTinyImages = function(document) {
  const imageNodeList = document.querySelectorAll('img');
  for(let imageElement of imageNodeList) {
    if(imageElement.width < 2 || imageElement.height < 2) {
      imageElement.remove();
    }
  }
};

// Unwraps single column and single cell tables
DOMAid.filterTableElements = function(document) {
  const tables = document.querySelectorAll('table');
  for(let table of tables) {
    let rows = table.rows;
    let rowLength = rows.length;

    if(rowLength === 1) {
      let cells = rows[0].cells;
      if(cells.length === 1) {
        DOMAid.unwrapSingleCellTable(table);
        continue;
      }
    }

    if(DOMAid.isSingleColumnTable(table)) {
      DOMAid.unwrapSingleColumnTable(table);
    }
  }
};

// TODO: allow for empty rows?
DOMAid.unwrapSingleCellTable = function(table) {
  const cell = table.rows[0].cells[0];
  const document = table.ownerDocument;
  const tableParent = table.parentNode;
  tableParent.insertBefore(document.createTextNode(' '), table);
  insertChildrenBefore(cell, table);
  tableParent.insertBefore(document.createTextNode(' '), table);
  table.remove();
};

// Examines the first 50 rows of a table element and decides whether
// the table is probably a simple single column table
DOMAid.isSingleColumnTable = function(table) {
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

DOMAid.unwrapSingleColumnTable = function(table) {
  const document = table.ownerDocument;
  const tableParent = table.parentNode;
  tableParent.insertBefore(document.createTextNode(' '), table);
  for(let row of table.rows) {
    for(let cell of row.cells) {
      insertChildrenBefore(cell, table);
    }
    tableParent.insertBefore(document.createElement('p'), table);
  }
  tableParent.insertBefore(document.createTextNode(' '), table);
  table.remove();
};
