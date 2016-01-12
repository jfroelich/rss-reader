// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: utf8.js

// TODO: review why I am using the overrideMimeType approach. It seems like it
// would be better to use the responseType approach. I cannot remember why I
// chose to implement it in this way.
// TODO: the re-parsing of the xml does not seem to be avoiding encoding errors,
// the same error just re-appears. So it seems pretty stupid to try and reparse.
// However, the root issue of how invalid xml is handled is still present.
// Example error such as invalid UTF-8 characters. For example:
// "error on line 1010 at column 25: Input is not proper UTF-8,
// indicate encoding ! Bytes: 0x07 0x50 0x72 0x65"
// TODO: i do not like how this does the explicit xml parsing again, I would
// prefer to defer to and reuse the code in /xml/parse-xml.js. However, the
// problem is that that code throws an exception in case of an embedded
// parsererror element, whereas here we can silently remove it and the xml
// file still appears to be nominally valid.
// TODO: i should consisently pass the same type of arguments to the final
// callback. Right now this passes strings, objects, errors, and exception
// objects to the first error argument.

'use strict';

{ // BEGIN FILE SCOPE

const MIME_TYPE_XML = 'application/xml';

function fetchXML(url, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;

  // TODO: these should all pass back responseURL as well, look at how
  // i did this in fetchHTML

  request.onerror = callback;
  request.ontimeout = callback;
  request.onabort = callback;
  request.onload = onFetch.bind(request, url, callback);
  request.open('GET', url, true);
  request.overrideMimeType(MIME_TYPE_XML);
  request.send();
}

this.fetchXML = fetchXML;

function onFetch(url, callback, event) {

  const request = event.target;
  const responseURL = request.responseURL;
  let document = request.responseXML;

  if(!document) {
    try {
      const encoded = utf8.encode(request.responseText);
      const parser = new DOMParser();
      const reparsedDocument = parser.parseFromString(encoded,
        MIME_TYPE_XML);

      const error = reparsedDocument.querySelector('parsererror');
      if(error) {
        error.remove();
      }

      document = reparsedDocument;
    } catch(exception) {
      // temp: debugging
      // note: we intentionally fall through here
      console.debug('fetchXML exception %o', exception);
    }
  }

  if(!document || !document.documentElement) {
    callback(event, null, responseURL);
    return;
  }

  callback(null, document, responseURL);
}

} // END FILE SCOPE
