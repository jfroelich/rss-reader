// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Note: requires getElementTextOrAttribute from dom-utilities

/**
 * Convert an XMLDocument representing a feed into a feed object.
 *
 * Returns an error property if xmlDocument is undefined, or if xmlDocument.documentElement
 * is undefined, or if the document is not one of the supported types.
 */
function createFeedFromDocument(xmlDocument) {

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

  var isRSS = documentElement.matches('rss');
  var isAtom = documentElement.matches('feed');
  var isRDF = documentElement.matches('rdf');

  var isDocumentTypeSupported = isRSS || isAtom || isRDF;

  if(!isDocumentTypeSupported) {
    result.ERROR_UNSUPPORTED_DOCUMENT_ELEMENT = true;
    result.ERROR_DOCUMENT_ELEMENT_NAME = documentElement.localName;
    return result;
  }

  var feedTitleText = getElementTextOrAttribute(documentElement,
    isAtom ? ['feed > title'] : ['channel > title']);
  if(feedTitleText) {
    result.title = feedTitleText;
  }

  var feedDescriptionText = getElementTextOrAttribute(documentElement,
    isAtom ? ['feed > subtitle'] : ['channel > description']);
  if(feedDescriptionText) {
    result.description = feedDescriptionText;
  }

  var feedLinkSelectors, feedLinkText;
  if(isAtom) {
    feedLinkSelectors = ['feed > link[rel="alternate"]', 'feed > link[rel="self"]', 'feed > link'];
    feedLinkText = getElementTextOrAttribute(documentElement, feedLinkSelectors, 'href');
    if(feedLinkText) {
      result.link = feedLinkText;
    }
  } else {
    // Prefer the textContent of a link element that does not have an href
    feedLinkText = getElementTextOrAttribute(documentElement, ['channel > link:not([href])']);
    if(feedLinkText) {
      result.link = feedLinkText;
    } else {
      // Fall back to href attribute value for any link
      feedLinkText = getElementTextOrAttribute(documentElement, ['channel > link'], 'href');
      if(feedLinkText) {
        result.link = feedLinkText;
      }
    }
  }

  // Set feed date (pubdate or similar, for entire feed)
  var feedDateSelectors = isAtom ? ['feed > updated'] :
    (isRSS ? ['channel > pubdate', 'channel > lastBuildDate', 'channel > date'] : ['channel > date']);
  var feedDateText = getElementTextOrAttribute(documentElement, feedDateSelectors);
  if(feedDateText) {
    result.date = feedDateText;
  }

  var entryElementSelector = isAtom ? 'feed > entry' :
      isRSS ? 'channel > item' : 'item';
  var entryElements = documentElement.querySelectorAll(entryElementSelector);
  var entryObjects = Array.prototype.map.call(entryElements,
      createEntryFromElement.bind(null, isAtom, isRSS));
  result.entries = [];

  // TEMP (this works, but thinking about how to write it more elegantly below)
  entryObjects.forEach(function(entry) {
    result.entries.push(entry);
  });

  //entryObjects.forEach(Array.prototype.push.bind(result.entries));

  // TODO: use push.apply/call somehow? push can accept multiple args to add,
  // so using forEach is not necessary
  //result.entries.push.apply(entryObjects);

  return result;
}

function createEntryFromElement(isAtom, isRSS, entryElement) {
  var result = {};

  var entryTitleText = getElementTextOrAttribute(entryElement, ['title']);
  if(entryTitleText) {
    result.title = entryTitleText;
  }

  var entryLinkText = isAtom ?  getElementTextOrAttribute(entryElement,
    ['link[rel="alternate"]','link[rel="self"]','link[href]'], 'href') :
    getElementTextOrAttribute(entryElement, ['origLink','link']);
  if(entryLinkText) {
    result.link = entryLinkText;
  }

  var entryAuthorText = getElementTextOrAttribute(entryElement,
    isAtom ? ['author name'] : ['creator','publisher']);
  if(entryAuthorText) {
    result.author = entryAuthorText;
  }

  var entryPubDateText = getElementTextOrAttribute(entryElement,
    isAtom ? ['published','updated'] : (isRSS ? ['pubDate'] : ['date']));
  if(entryPubDateText) {
    result.pubdate = entryPubDateText;
  }

  var entryContentText = isAtom ?  getTextContentForAtomEntry(entryElement) :
    getElementTextOrAttribute(entryElement,['encoded','description','summary']);
  if(entryContentText) {
    result.content = entryContentText;
  }

  return result;
}


/**
 * I ran into weirdness for atom feed entry content, hence the more
 * detailed handling of this situation.
 *
 * I am sure a cleaner solution exists or I am missing something basic.
 * However, this at least for now gives the desired result.
 */
function getTextContentForAtomEntry(entryElement) {

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
}
