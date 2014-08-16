// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};

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

  var access = lucu.getTextOrAttribute;

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

  var entrySelector = isAtom ? 'feed > entry' : isRSS ? 'channel > item' : 'item';
  var entries = documentElement.querySelectorAll(entrySelector);
  var toEntryObject = lucu.feed.createEntryFromElement.bind(this, isAtom, isRSS);
  result.entries = lucu.map(entries, toEntryObject);

  return result;
};

lucu.feed.createEntryFromElement = function(isAtom, isRSS, entryElement) {
  var result = {};

  var access = lucu.getTextOrAttribute;

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

    // TODO: clean this up more? On the one hand it is all a hack I want to
    // deprecate. On the other, using Array.prototype.map is more
    // appropriate than forEach + push

    var parts = [];

    // Serialize element content differently than text content
    Array.prototype.forEach.call(contentElement.childNodes, function(atomContentNode) {
      if(atomContentNode.nodeType == Node.ELEMENT_NODE) {
        parts.push(atomContentNode.innerHTML);
      } else if(atomContentNode.nodeType == Node.TEXT_NODE) {
        parts.push(atomContentNode.textContent);
      } else if(atomContentNode.nodeType == Node.CDATA_SECTION_NODE) {
        parts.push(atomContentNode.textContent);
      }
    });

    text = parts.join('').trim();

    // A last ditch effort, may produce garbage or even be
    // redundant with above
    if(!text) {
      text = contentElement.textContent || '';
      text = text.trim();
    }
  }

  return text;
};

// Wraps element.getAttribute. Used for partial on attribute (due to arg order)
// instead of just HTMLElement.prototype.getAttribute
lucu.getAttribute = function(attribute, element) {
  return element.getAttribute(attribute);
};

lucu.getTextContent = function(element) {
  return element.textContent;
};

/**
 * Gets the textContent of a specific element or the value of a specific
 * attribute in the element. The value of the attribute is retrieved if an
 * attribute is specified. Returns undefined if nothing matches or
 * the value for anything that did match was empty.
 *
 * Reasons why this function is useful:
 * 1) Searching for a comma separated list of selectors works in document
 * order, regardless of the order of the selectors. By using an array
 * of separate selectors, we can prioritize selector order over
 * document order in the specification.
 * 2) We sometimes want to get the value of an attribute instead of
 * the text content. Searching for the attribute involves nearly all the
 * same steps as searching for the element.
 * 3) We want to only consider non-empty values as matching.
 * querySelectorAll stops once the element matches, and does not let
 * us compose additional concise and exact conditions on the textContent
 * value or attribute value. So this function enables us to fallback to later
 * selectors by merging in the non-empty-after-trimming condition.
 * 4) We want short circuiting. querySelectorAll walks the entire
 * document every time, which is a waste.
 */
lucu.getTextOrAttribute = function(rootElement, selectors, attribute) {
  var getter;
  if(attribute) {
    getter = lucu.getAttribute.bind(this, attribute);
  } else {
    getter = lucu.getTextContent;
  }

  // NOTE: using a raw loop because nothing in the native iteration API
  // fits because of the need to use side effects and the need to short
  // circuit

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
