// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: research whether new URL features are now supported
// TODO: rename file to url-utils.js

class URLUtils {

  static isValid(url) {
    try {
      let uri = URI(url);
      return uri && uri.protocol() && uri.hostname();
    } catch(e) {

    }

    return false;
  }

  static getSchemeless(url) {
    const uri = new URI(url);
    uri.protocol('');
    return uri.toString().substring(2);
  }

  static isDataURI(url) {
    return /^\s*data\s*:/i.test(url);
  }

  static rewrite(url) {
    const GOOGLE_NEWS = 
      /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
    const matches = GOOGLE_NEWS.exec(url);
    if(matches && matches.length === 2 && matches[1]) {
      return decodeURIComponent(matches[1]);
    }
    return url;
  }
}
