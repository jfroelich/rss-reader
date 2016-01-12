// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Returns true if the url is minimally valid.
// Requires the URI lib
function isValidURL(url) {
  'use strict';
  try {
    let uri = URI(url);
    return uri && uri.protocol() && uri.hostname();
  } catch(e) {

  }

  // TODO: we could fallback to default return undefined;
  // by not returning anything?
  return false;
}
