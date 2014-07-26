// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};

// Requires lucu.element.getTextOrAttribute
// .feed is a namespace present in other files so avoid resetting it here
lucu.feed = lucu.feed || {};

/**
 * Convert an XMLDocument representing a feed into a feed object.
 *
 * Returns an error property if xmlDocument is undefined, or if xmlDocument.documentElement
 * is undefined, or if the document is not one of the supported types.
 */
lucu.feed.createFromDocument = function(xmlDocument) {

  var result = {};

  if(!xmlDocument) {
    result.ERROR_UNDEFINED_DOCUMENT = true;
    return result;
  }

  var documentElement = xmlDocument.documentElement;

  if(!documentElement) {
    result.ERROR_UNDEFINED_DOCUMENT_ELEMENT = true;
    return result;
  }

  // TODO: This should be an enum instead of 3 boolean flags. It will
  // simplify passing around the enum. Or, instead, I should be
  // passing documentElement to createEntryFromElement which should
  // recreate these booleans locally. Or, even better, I should be using
  // some statically defined JSON-like specification that controls these
  // flags and a factory-like method that looks up the per-type
  // fields

  var isRSS = documentElement.matches('rss');
  var isAtom = documentElement.matches('feed');
  var isRDF = documentElement.matches('rdf');

  var isDocumentTypeSupported = isRSS || isAtom || isRDF;

  if(!isDocumentTypeSupported) {
    result.ERROR_UNSUPPORTED_DOCUMENT_ELEMENT = true;
    result.ERROR_DOCUMENT_ELEMENT_NAME = documentElement.localName;
    return result;
  }

  var access = lucu.element.getTextOrAttribute;

  var feedTitleText = access(documentElement, isAtom ? ['feed > title'] : ['channel > title']);
  if(feedTitleText) {
    result.title = feedTitleText;
  }

  var feedDescriptionText = access(documentElement,
    isAtom ? ['feed > subtitle'] : ['channel > description']);
  if(feedDescriptionText) {
    result.description = feedDescriptionText;
  }

  var feedLinkSelectors, feedLinkText;
  if(isAtom) {
    feedLinkSelectors = ['feed > link[rel="alternate"]', 'feed > link[rel="self"]', 'feed > link'];
    feedLinkText = access(documentElement, feedLinkSelectors, 'href');
    if(feedLinkText) {
      result.link = feedLinkText;
    }
  } else {
    // Prefer the textContent of a link element that does not have an href
    feedLinkText = access(documentElement, ['channel > link:not([href])']);
    if(feedLinkText) {
      result.link = feedLinkText;
    } else {
      // Fall back to href attribute value for any link
      feedLinkText = access(documentElement, ['channel > link'], 'href');
      if(feedLinkText) {
        result.link = feedLinkText;
      }
    }
  }

  // Set feed date (pubdate or similar, for entire feed)
  var feedDateSelectors = isAtom ? ['feed > updated'] :
    (isRSS ? ['channel > pubdate', 'channel > lastBuildDate', 'channel > date'] : ['channel > date']);
  var feedDateText = access(documentElement, feedDateSelectors);
  if(feedDateText) {
    result.date = feedDateText;
  }

  var entryElementSelector = isAtom ? 'feed > entry' :
      isRSS ? 'channel > item' : 'item';
  var entryElements = documentElement.querySelectorAll(entryElementSelector);

  // TODO: rather than map, do something like
  // lucu.element.map(entryElements, toEntry);

  // NOTE: unclear if this is needed
  entryElements = entryElements || [];

  var map = Array.prototype.map;
  var toEntry = lucu.feed.createEntryFromElement.bind(null, isAtom, isRSS);
  result.entries = map.call(entryElements, toEntry);

  return result;
};

lucu.feed.createEntryFromElement = function(isAtom, isRSS, entryElement) {
  var result = {};

  var access = lucu.element.getTextOrAttribute;

  var entryTitleText = access(entryElement, ['title']);
  if(entryTitleText) {
    result.title = entryTitleText;
  }

  var entryLinkText = isAtom ?  access(entryElement,
    ['link[rel="alternate"]','link[rel="self"]','link[href]'], 'href') :
    access(entryElement, ['origLink','link']);
  if(entryLinkText) {
    result.link = entryLinkText;
  }

  var entryAuthorText = access(entryElement,
    isAtom ? ['author name'] : ['creator','publisher']);
  if(entryAuthorText) {
    result.author = entryAuthorText;
  }

  var entryPubDateText = access(entryElement,
    isAtom ? ['published','updated'] : (isRSS ? ['pubDate'] : ['date']));
  if(entryPubDateText) {
    result.pubdate = entryPubDateText;
  }

  var accessAtom = lucu.feed.getTextContentForAtomEntry;

  var entryContentText = isAtom ? accessAtom(entryElement) :
    access(entryElement,['encoded','description','summary']);
  if(entryContentText) {
    result.content = entryContentText;
  }

  return result;
};


/**
 * I ran into weirdness for atom feed entry content, hence the more
 * detailed handling of this situation.
 *
 * I am sure a cleaner solution exists or I am missing something basic.
 * However, this at least for now gives the desired result.
 */
lucu.feed.getTextContentForAtomEntry = function(entryElement) {

  var contentElement = entryElement.querySelector('content');
  var text;

  if(contentElement) {

    var contentParts = [];

    // Serialize element content differently than text content
    Array.prototype.forEach.call(contentElement.childNodes, function(atomContentNode) {
      if(atomContentNode.nodeType == Node.ELEMENT_NODE) {
        contentParts.push(atomContentNode.innerHTML);
      } else if(atomContentNode.nodeType == Node.TEXT_NODE) {
        contentParts.push(atomContentNode.textContent);
      } else if(atomContentNode.nodeType == Node.CDATA_SECTION_NODE) {
        contentParts.push(atomContentNode.textContent);
      }
    });

    text = contentParts.join('').trim();

    // A last ditch effort, may produce garbage or even be
    // redundant with above
    if(!text) {
      text = contentElement.textContent || '';
      text = text.trim();
    }
  }

  return text;
};
