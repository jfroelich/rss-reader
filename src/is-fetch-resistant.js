// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const HOSTNAMES = [
  'productforums.google.com',
  'groups.google.com',
  'www.forbes.com',
  'forbes.com'
];

// hostname getter normalizes url part to lowercase
this.is_fetch_resistant = function(url) {
  console.assert(url);
  console.assert(url.hostname);
  return HOSTNAMES.includes(url.hostname);
};

} // End file block scope
