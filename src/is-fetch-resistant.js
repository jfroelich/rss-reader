// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// TODO: rename file to is-fetch-resistant-url.js

const HOSTNAMES = [
  'productforums.google.com',
  'groups.google.com',
  'www.forbes.com',
  'forbes.com'
];

// hostname getter normalizes url part to lowercase
function isFetchResistantURL(url) {
  console.assert(url);
  console.assert(url.hostname);
  return HOSTNAMES.includes(url.hostname);
}

this.isFetchResistantURL = isFetchResistantURL;

} // End file block scope
