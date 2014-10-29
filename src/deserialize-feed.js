// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Convert an XMLDocument containing feed data into an object
 *
 * Returns an error property if xmlDocument is undefined, or if
 * xmlDocument.documentElement is undefined, or if the document is not one of
 * the supported types.
 *
 * TODO: throw exceptions instead of returning error code
 * TODO: maybe this should produce an actual 'Feed' function object instead of a
 * generic Javascript object
 */
lucu.deserializeFeed = function (xmlDocument) {
  'use strict';

  var map = Array.prototype.map;
  var getHTMLOrText = function (node) {
    return node.nodeType == Node.ELEMENT_NODE ?
      node.innerHTML : node.textContent;
  };
  var getTextContent = function (element) {
    return element.textContent;
  };
  var getAtomText = function (entryElement) {
    var contentElement = entryElement.querySelector('content');
    var nodes = contentElement ? contentElement.childNodes : [];
    return map.call(nodes, getHTMLOrText).join('').trim();
  };

  var getText = function (rootElement, selectors, attribute) {
    var getter;
    if(attribute) {
      getter = function(element) {
        return element.getAttribute(attribute);
      };
    } else {
      getter = getTextContent;
    }

    for(var i = 0, temp; i < selectors.length; i++) {
      temp = rootElement.querySelector(selectors[i]);
      if(!temp) continue;
      temp = getter(temp);
      if(!temp) continue;
      temp = temp.trim();
      if(!temp) continue;
      return temp;
    }
  };

  var result = {};

  if(!xmlDocument) {
    throw new TypeError('Undefined document');
  }

  var documentElement = xmlDocument.documentElement;

  if(!documentElement) {
    throw new TypeError('Undefined document element');
  }

  var isRSS = documentElement.matches('rss');
  var isAtom = documentElement.matches('feed');
  var isRDF = documentElement.matches('rdf');

  if(!isRSS && !isAtom && !isRDF) {
    throw new TypeError('Invalid document element ' +
      documentElement.localName);
  }

  var feedTitleText = getText(documentElement, isAtom ? ['feed > title'] :
    ['channel > title']);
  if(feedTitleText) {
    result.title = feedTitleText;
  }

  var feedDescriptionText = getText(documentElement,
    isAtom ? ['feed > subtitle'] : ['channel > description']);
  if(feedDescriptionText) {
    result.description = feedDescriptionText;
  }

  var feedLinkSelectors, feedLinkText;
  if(isAtom) {
    feedLinkSelectors = ['feed > link[rel="alternate"]',
      'feed > link[rel="self"]', 'feed > link'];
    feedLinkText = getText(documentElement, feedLinkSelectors, 'href');
    if(feedLinkText) {
      result.link = feedLinkText;
    }
  } else {
    // Prefer the textContent of a link element that does not have an href
    feedLinkText = getText(documentElement, ['channel > link:not([href])']);
    if(feedLinkText) {
      result.link = feedLinkText;
    } else {
      // Fall back to href attribute value for any link
      feedLinkText = getText(documentElement, ['channel > link'], 'href');
      if(feedLinkText) {
        result.link = feedLinkText;
      }
    }
  }

  // Set feed date (pubdate or similar, for entire feed)
  var feedDateSelectors = isAtom ? ['feed > updated'] :
    (isRSS ? ['channel > pubdate', 'channel > lastBuildDate',
      'channel > date'] : ['channel > date']);
  var feedDateText = getText(documentElement, feedDateSelectors);
  if(feedDateText) {
    result.date = feedDateText;
  }

  var entrySelector = isAtom ? 'feed > entry' : isRSS ?
    'channel > item' : 'item';
  var entries = documentElement.querySelectorAll(entrySelector);
  result.entries = map.call(entries, function (entryElement) {
    var result = {};
    var entryTitleText = getText(entryElement, ['title']);
    if(entryTitleText) {
      result.title = entryTitleText;
    }

    var entryLinkText = isAtom ?  getText(entryElement,
      ['link[rel="alternate"]','link[rel="self"]','link[href]'], 'href') :
      getText(entryElement, ['origLink','link']);
    if(entryLinkText) {
      result.link = entryLinkText;
    }

    var entryAuthorText = getText(entryElement,
      isAtom ? ['author name'] : ['creator','publisher']);
    if(entryAuthorText) {
      result.author = entryAuthorText;
    }

    var entryPubDateText = getText(entryElement,
      isAtom ? ['published','updated'] : (isRSS ? ['pubDate'] : ['date']));
    if(entryPubDateText) {
      result.pubdate = entryPubDateText;
    }

    var entryContentText = isAtom ? getAtomText(entryElement) :
      getText(entryElement,['encoded','description','summary']);
    if(entryContentText) {
      result.content = entryContentText;
    }

    return result;
  });
  return result;
};
