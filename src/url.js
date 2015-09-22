// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.url = {};

lucu.url.isValid = function(url) {

  if(!url) {
    return false;
  }

  // Use medialize
  try {
    var uri = URI(url);
  } catch(e) {
    console.debug(e);
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
