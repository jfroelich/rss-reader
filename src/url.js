// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file


// Requires: /lib/URI.js

// Returns a url string without its protocol
function url_filter_protocol(url) {
  'use strict';
  const uri = new URI(url);
  uri.protocol('');
  // Remove the leading slashes before returning
  return uri.toString().substring(2);
}

function url_is_object(url) {
  'use strict';
  return /^\s*data\s*:/i.test(url);
}

// Returns true if the url is minimally valid
function url_is_valid(url) {
  'use strict';
  try {
    let uri = URI(url);
    return uri && uri.protocol() && uri.hostname();
  } catch(e) {

  }
}
