// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: consider merging all filters into a single recursive
// function, this might remove some of the redundancy that happens and some
// of the issues with non-associativeness of filters. Order shouldn't affect
// the outcome as much.

// Routines for cleaning up nodes in an HTMLDocument
const DOMAid = Object.create(null);

// Applies a series of filters to a document. Modifies the document
// in place. The filters are applied in a preset order so as to minimize the
// work done by each sequential step, and to ensure proper handling of
// things like frameset elements.
DOMAid.cleanDocument = function(document) {
  DOMAid.filterCommentNodes(document);
  DOMAid.filterFrameElements(document);
  DOMAid.filterNoscriptElements(document);
  DOMAid.filterBlacklistedElements(document);
  filterHiddenElements(document);

  adjustBlockWithinInlineElements(document);

  DOMAid.replaceBRElements(document);
  DOMAid.filterAnchorElements(document);

  DOMAid.filterImageElements(document);

  filterUnwrappableElements(document);
  DOMAid.filterFigureElements(document);
  condenseTextNodeWhitespace(document);
  DOMAid.filterListElements(document);

  const inspectionRowLimit = 20;
  filterTableElements(document, inspectionRowLimit);
  filterLeafElements(document);
  DOMAid.filterMisplacedHRElements(document);
  DOMAid.filterConsecutiveHRElements(document);

  // TODO: deprecate once replaceBRElements is fixed?
  DOMAid.filterConsecutiveBRElements(document);
  trimDocument(document);
  DOMAid.filterAttributes(document);
};

DOMAid.filterMisplacedHRElements = function(document) {
  const hrs = document.querySelectorAll('hr');
  for(let i = 0, len = hrs.length; i < len; i++) {
    let hr = hrs[i];
    if(hr.parentNode.nodeName === 'UL') {
      hr.remove();
    }
  }
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
DOMAid.filterNoscriptElements = function(document) {
  const elementNodeList = document.querySelectorAll('noscript');
  const nullReferenceNode = null;
  // Not using for .. of due to profiling error NotOptimized TryCatchStatement
  //for(let element of elementNodeList) {
  for(let i = 0, len = elementNodeList.length; i < len; i++) {
    let element = elementNodeList[i];
    unwrapElement(element, nullReferenceNode);
  }
};

DOMAid.filterCommentNodes = function(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let comment = it.nextNode(); comment; comment = it.nextNode()) {
    comment.remove();
  }
};

// TODO: what if both body and frameset are present?
// TODO: there can be multiple bodies when illformed. Maybe use
// querySelectorAll and handle multi-body branch differently
DOMAid.filterFrameElements = function(document) {
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
// TODO: merge into filter anchors
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
DOMAid.filterAnchorElements = function(document) {
  const anchors = document.querySelectorAll('a');
  for(let i = 0, len = anchors.length; i < len; i++) {
    let anchor = anchors[i];
    if(DOMAid.isFormattingAnchor(anchor) ||
      DOMAid.isJavascriptAnchor(anchor)) {
      unwrapElement(anchor);
    }
  }
};

// Unwrap lists with only one item.
DOMAid.filterListElements = function(document) {
  const ITEM_NAMES = {'LI': 1, 'DT': 1, 'DD': 1};
  const lists = document.querySelectorAll('UL, OL, DL');
  for(let i = 0, len = lists.length; i < len; i++) {
    let listElement = lists[i];
    if(listElement.childElementCount === 1) {
      let itemElement = listElement.firstElementChild;
      if(itemElement.nodeName in ITEM_NAMES) {
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

// TODO: merge with filterMisplacedHRElements
DOMAid.filterConsecutiveHRElements = function(document) {
  const elements = document.querySelectorAll('HR');
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    let prev = element.previousSibling;
    if(prev && prev.nodeName === 'HR') {
      prev.remove();
    }
  }
};

// TODO: merge with replaceBRElements
DOMAid.filterConsecutiveBRElements = function(document) {
  const elements = document.querySelectorAll('BR');
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    let prev = element.previousSibling;
    if(prev && prev.nodeName === 'BR') {
      prev.remove();
    }
  }
};

// TODO: improve, this is very buggy
// error case: http://paulgraham.com/procrastination.html
// TODO: I think using substrings and insertAdjacentHTML might actually
// be the simplest solution? Cognitively, at least.

DOMAid.replaceBRElements = function(document) {
  const nodeList = document.querySelectorAll('BR');
  for(let i = 0, len = nodeList.length; i < len; i++) {
    //let brElement = nodeList[i];
    //brElement.renameNode('p');
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
  for(let i = 0, len = figures.length; i < len; i++) {
    let figure = figures[i];
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

  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
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
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(docElement.contains(element)) {
      element.remove();
    }
  }
};

DOMAid.filterImageElements = function(document) {
  const images = document.querySelectorAll('img');

  // Filter sourceless images
  for(let i = 0, len = images.length; i < len; i++) {
    let imageElement = images[i];
    if(!imageElement.hasAttribute('src') &&
      !imageElement.hasAttribute('srcset')) {
      imageElement.remove();
    }
  }

  // Filter tiny images
  for(let i = 0, len = images.length; i < len; i++) {
    let imageElement = images[i];
    if(imageElement.width < 2 || imageElement.height < 2) {
      imageElement.remove();
    }
  }
};
