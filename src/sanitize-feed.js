// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Returns a sanitized copy of dirtyFeed.
 *
 * TODO: html entities?
 */
lucu.sanitizeFeed = function(inputFeed) {
  'use strict';

  const sfs = lucu.sanitizeFeedString;

  const outputFeed = {};

  const title = sfs(inputFeed.title);
  if(title) {
  	outputFeed.title = title;
  }

  const description = sfs(inputFeed.description);
  if(description) {
  	outputFeed.description = description;
  }
  
  const link = sfs(inputFeed.link);
  if(link) {
  	outputFeed.link = link;
  }
  
  if(inputFeed.date) {
  	outputFeed.date = inputFeed.date;
  }
  
  return outputFeed;
};

lucu.sanitizeFeedString = function(string) {
  'use strict';

  if(!string) {
  	return;
  }

  string = lucu.string.stripTags(string);

  if(string) {
  	string = lucu.string.stripControls(string);
  }

  string = lucu.string.condenseWhitespace(string);
  
  if(string) {
  	string = string.trim();
  }
  
  return string;
};
