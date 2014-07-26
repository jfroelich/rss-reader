// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.mime = {};

// Gets the mime type from the XMLHttpRequest. Note that for now
// this does not actually parse it, it just gets the full header
lucu.mime.getType = function(request) {
  if(request) {
    return request.getResponseHeader('Content-Type');
  }
};

lucu.mime.isFeed = function(contentType) {
  return /(application|text)\/(atom|rdf|rss)?\+?xml/i.test(contentType);
};

lucu.mime.isTextHTML = function(contentType) {
  return /text\/html/i.test(contentType);
};

lucu.mime.isTextPlain = function(contentType) {
  return /text\/plain/i.test(contentType);
};

lucu.mime.isTextHTMLOrPlain = function(contentType) {
  return /text\/(plain|html)/i.test(contentType);
};
