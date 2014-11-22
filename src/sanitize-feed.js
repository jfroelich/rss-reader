// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Returns a sanitized copy of dirtyFeed.
 *
 * TODO: html entities?
 */
lucu.sanitizeFeed = function(feed) {
  'use strict';
  function sanitizeString(str) {
    if(!str) return;
    str = lucu.stripTags(str);
    if(str) str = lucu.stripControls(str);
    if(str) str = str.replace(/\s+/,' ');
    if(str) str = str.trim();
    return str;
  }

  var output = {};
  var title = sanitizeString(feed.title);
  if(title) output.title = title;
  var description = sanitizeString(feed.description);
  if(description) output.description = description;
  var link = sanitizeString(feed.link);
  if(link) output.link = link;
  if(feed.date) output.date = feed.date;
  return output;
};
