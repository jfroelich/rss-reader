// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function is_fetch_resistant(url) {
  console.assert(url && url.hostname);
  const blacklist = [
    'productforums.google.com',
    'groups.google.com',
    'www.forbes.com',
    'forbes.com'
  ];

  // hostname getter normalizes url part to lowercase
  return blacklist.includes(url.hostname);
}
