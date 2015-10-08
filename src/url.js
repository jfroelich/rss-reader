// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.url = {};

lucu.url.isValid = function(url) {
  'use strict';
  if(!url) {
    return false;
  }

  // Use medialize
  var uri = '';
  try {
    uri = URI(url);
  } catch(e) {
    console.debug(e);
    return false;
  }

  if(!uri) {
    return false;
  }

  if(!uri.protocol()) {
    return false;
  }

  if(!uri.hostname()) {
    return false;
  }

  return true;
};

// NOTE: requires URI.js
lucu.url.getSchemeless = function(url) {
  'use strict';
  const uri = new URI(url);
  uri.protocol('');
  const schemeless = uri.toString().substring(2);
  return schemeless;
};
