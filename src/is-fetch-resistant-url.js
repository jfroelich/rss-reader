// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';



{ // Begin file block scope

const hostNames = [
  'productforums.google.com',
  'groups.google.com',
  'www.forbes.com',
  'forbes.com'
];

function isFetchResistantURL(url) {
  console.assert(url);
  console.assert(url.hostname);
  // hostname getter normalizes to lowercase
  return hostNames.includes(url.hostname);
}

var rdr = rdr || {};
rdr.isFetchResistantURL = isFetchResistantURL;

} // End file block scope
