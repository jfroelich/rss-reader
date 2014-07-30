// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * Returns a sanitized version of a remote feed object.
 * The remoteFeed object is not modified. Only certain
 * properties are sanitized and included in the returned object
 * TODO: deal with html entities
 */
function sanitizeRemoteFeed(remoteFeed) {
  var output = {};

  var title = sanitizeRemoteFeedProperty(remoteFeed.title);
  if(title) {
    output.title = title;
  }

  var description = sanitizeRemoteFeedProperty(remoteFeed.description);
  if(description) {
    output.description = description;
  }

  var link = sanitizeRemoteFeedProperty(remoteFeed.link);
  if(link) {
    output.link = link;
  }

  if(remoteFeed.date) {
    output.date = remoteFeed.date;
  }

  return output;
}

/**
 * TODO: should we replace HTML entities after
 * stripping tags? Some entities? All entities?
 */
function sanitizeRemoteFeedProperty(str) {

  if(!str) {
    return;
  }

  str = lucu.string.stripTags(str);

  if(str) {
    str = lucu.string.stripControls(str);
  }

  // TODO: this should be a call to a separate function
  // or maybe merged with lucu.string.stripControls
  // (one pass instead of two)
  if(str) {
    str = str.replace(/\s+/,' ');
  }

  // If there is anything left in the string, trim it.
  if(str) {
    str = str.trim();
  }

  return str;
}
