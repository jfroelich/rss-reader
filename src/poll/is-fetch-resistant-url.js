// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.poll = rdr.poll || {};

rdr.poll.resistantHosts = [
  'productforums.google.com',
  'groups.google.com',
  'www.forbes.com',
  'forbes.com'
];

rdr.poll.isFetchResistantURL = function(url) {

  if(!rdr.utils.isURLObject(url)) {
    throw new TypeError('invalid url param: ' + url);
  }

  // hostname getter normalizes to lowercase
  return rdr.poll.resistantHosts.includes(url.hostname);
};
