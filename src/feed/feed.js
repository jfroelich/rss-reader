// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.feed = lucu.feed || {};

// Could lucu.object.at.bind(null, 'url') or something like that
// work instead?
lucu.feed.hasURL = function(feed) {
  return !!feed.url;
};
