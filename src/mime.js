// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function isContentTypeFeed(contentType) {
  return /(application|text)\/(atom|rdf|rss)?\+?xml/i.test(contentType);
}

function isContentTypeHTML(contentType) {
  return /text\/html/i.test(contentType);
}

function isContentTypeText(contentType) {
  return /text\/plain/i.test(contentType);
}

function isContentTypeHTMLOrText(contentType) {
  return /text\/(plain|html)/i.test(contentType);
}
