// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Note: requires lucu.element.getTextOrAttribute from dom-utilities

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

  var feedTitleText = lucu.element.getTextOrAttribute(documentElement,
    isAtom ? ['feed > title'] : ['channel > title']);
  if(feedTitleText) {
    result.title = feedTitleText;
  }

  var feedDescriptionText = lucu.element.getTextOrAttribute(documentElement,
    isAtom ? ['feed > subtitle'] : ['channel > description']);
  if(feedDescriptionText) {
    result.description = feedDescriptionText;
  }

  var feedLinkSelectors, feedLinkText;
  if(isAtom) {
    feedLinkSelectors = ['feed > link[rel="alternate"]', 'feed > link[rel="self"]', 'feed > link'];
    feedLinkText = lucu.element.getTextOrAttribute(documentElement, feedLinkSelectors, 'href');
    if(feedLinkText) {
      result.link = feedLinkText;
    }
  } else {
    // Prefer the textContent of a link element that does not have an href
    feedLinkText = lucu.element.getTextOrAttribute(documentElement, ['channel > link:not([href])']);
    if(feedLinkText) {
      result.link = feedLinkText;
    } else {
      // Fall back to href attribute value for any link
      feedLinkText = lucu.element.getTextOrAttribute(documentElement, ['channel > link'], 'href');
      if(feedLinkText) {
        result.link = feedLinkText;
      }
    }
  }

  // Set feed date (pubdate or similar, for entire feed)
  var feedDateSelectors = isAtom ? ['feed > updated'] :
    (isRSS ? ['channel > pubdate', 'channel > lastBuildDate', 'channel > date'] : ['channel > date']);
  var feedDateText = lucu.element.getTextOrAttribute(documentElement, feedDateSelectors);
  if(feedDateText) {
    result.date = feedDateText;
  }

  var entryElementSelector = isAtom ? 'feed > entry' :
      isRSS ? 'channel > item' : 'item';
  var entryElements = documentElement.querySelectorAll(entryElementSelector);

  // NOTE: this might not be necessary, but it is unclear to me
  entryElements = entryElements || [];

  result.entries = Array.prototype.map.call(entryElements,
    createEntryFromElement.bind(null, isAtom, isRSS));

  return result;
}

function createEntryFromElement(isAtom, isRSS, entryElement) {
  var result = {};

  var entryTitleText = lucu.element.getTextOrAttribute(entryElement, ['title']);
  if(entryTitleText) {
    result.title = entryTitleText;
  }

  var entryLinkText = isAtom ?  lucu.element.getTextOrAttribute(entryElement,
    ['link[rel="alternate"]','link[rel="self"]','link[href]'], 'href') :
    lucu.element.getTextOrAttribute(entryElement, ['origLink','link']);
  if(entryLinkText) {
    result.link = entryLinkText;
  }

  var entryAuthorText = lucu.element.getTextOrAttribute(entryElement,
    isAtom ? ['author name'] : ['creator','publisher']);
  if(entryAuthorText) {
    result.author = entryAuthorText;
  }

  var entryPubDateText = lucu.element.getTextOrAttribute(entryElement,
    isAtom ? ['published','updated'] : (isRSS ? ['pubDate'] : ['date']));
  if(entryPubDateText) {
    result.pubdate = entryPubDateText;
  }

  var entryContentText = isAtom ?  getTextContentForAtomEntry(entryElement) :
    lucu.element.getTextOrAttribute(entryElement,['encoded','description','summary']);
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
