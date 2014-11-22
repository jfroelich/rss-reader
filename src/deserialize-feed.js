// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Convert an XML document containing feed data into an object
 *
 * TODO: somehow cleanup the ifs while not violating DRY
 */
lucu.deserializeFeed = function (document) {
  'use strict';

  var map = Array.prototype.map;

  function getText(rootElement, selectors, attribute) {
    for(var i = 0, temp; i < selectors.length; i++) {
      temp = rootElement.querySelector(selectors[i]);
      if(!temp) continue;
      temp = attribute ? temp.getAttribute(attribute) : temp.textContent;
      if(!temp) continue;
      temp = temp.trim();
      if(!temp) continue;
      return temp;
    }
  }

  var root = document.documentElement;
  if(!root) {
    throw new TypeError('Undefined document element');
  }

  var isRSS = root.matches('rss');
  var isAtom = root.matches('feed');
  var isRDF = root.matches('rdf');

  if(!isRSS && !isAtom && !isRDF) {
    throw new TypeError('Unsupported document element ' + root.localName);
  }

  var result = {};

  var title = getText(root, isAtom ? ['feed > title'] : ['channel > title']);
  if(title) result.title = title;

  var description = getText(root, isAtom ? ['feed > subtitle'] :
    ['channel > description']);
  if(description) result.description = description;

  var feedLinkSelectors, link;
  if(isAtom) {
    feedLinkSelectors = ['feed > link[rel="alternate"]',
      'feed > link[rel="self"]', 'feed > link'];
    link = getText(root, feedLinkSelectors, 'href');
    if(link) result.link = link;
  } else {
    // Prefer the textContent of a link element that does not have an href
    link = getText(root, ['channel > link:not([href])']);
    if(link) {
      result.link = link;
    } else {
      // Fall back to href attribute value for any link
      link = getText(root, ['channel > link'], 'href');
      if(link) result.link = link;
    }
  }

  // Set feed date (pubdate or similar, for entire feed)
  var feedDateSelectors = isAtom ? ['feed > updated'] :
    (isRSS ? ['channel > pubdate', 'channel > lastBuildDate',
      'channel > date'] : ['channel > date']);
  var date = getText(root, feedDateSelectors);
  if(date) result.date = date;

  var entrySelector = isAtom ? 'feed > entry' : isRSS ?
    'channel > item' : 'item';
  var entries = root.querySelectorAll(entrySelector);
  result.entries = map.call(entries, function (entry) {
    var result = {};
    var title = getText(entry, ['title']);
    if(title) result.title = title;
    var link = isAtom ?  getText(entry,
      ['link[rel="alternate"]', 'link[rel="self"]', 'link[href]'], 'href') :
      getText(entry, ['origLink','link']);
    if(link) result.link = link;
    var author = getText(entry, isAtom ? ['author name'] :
      ['creator', 'publisher']);
    if(author) result.author = author;
    var pubDate = getText(entry, isAtom ? ['published', 'updated'] :
      (isRSS ? ['pubDate'] : ['date']));
    if(pubDate) result.pubdate = pubDate;

    function getAtomText(entry) {
      var content = entry.querySelector('content');
      var nodes = content ? content.childNodes : [];
      return map.call(nodes, function (node) {
        return node.nodeType == Node.ELEMENT_NODE ?
          node.innerHTML : node.textContent;
      }).join('').trim();
    }

    var content = null;
    if(isAtom) {
      // For some atom feeds it picks up the CDATA content as
      // xml, so we need to work around it.
      content = entry.querySelector('content');
      var nodes = content ? content.childNodes : [];
      content = map.call(nodes, function (node) {
        // NOTE: why not just use node.nodeValue for text nodes?
        return node.nodeType == Node.ELEMENT_NODE ?
          node.innerHTML : node.textContent;
      }).join('').trim();
    } else {
      content = getText(entry, ['encoded', 'description', 'summary']);
    }

    if(content) result.content = content;
    return result;
  });
  return result;
};
