// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: the class was an experiment, but now I think it is dumb
// just use one large function

/**
 * Sends a request to the Google Feeds API to find feeds relevant
 * to a given query. Basically decorates an XMLHttpRequest.
 */
function GoogleFeedsRequest() {}

GoogleFeedsRequest.BASE_URL = 
  'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';

GoogleFeedsRequest.prototype.send = function(query) {
  'use strict';

  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.onerror = this.onerror;
  request.ontimeout = this.onerror;
  request.onabort = this.onerror;

  // Note that the bind is necessary
  request.onload = this._onload.bind(this);

  const url = GoogleFeedsRequest.BASE_URL + encodeURIComponent(query);
  request.open('GET', url, true);
  request.responseType = 'json';
  request.send();
};

GoogleFeedsRequest.prototype._onload = function(event) {
  'use strict';

  const request = event.target;
  const response = request.response;
  const data = response.responseData;
  const query = data.query || '';
  
  var entries = data.entries || [];

  // Some results do not have a url
  entries = entries.filter(GoogleFeedsRequest.entryHasURL);

  // Results have HTML that needs to be adjusted
  entries.forEach(GoogleFeedsRequest.sanitizeEntry);

  this.onload(query, entries);
};

GoogleFeedsRequest.entryHasURL = function(entry) {
  'use strict';
  return entry.url;
};

GoogleFeedsRequest.BREAK_RULE = /<br>/gi;

GoogleFeedsRequest.sanitizeEntry = function(entry) {
  'use strict';

  if(!entry) {
    return;
  }

  if(entry.title) {
    entry.title = stripTags(entry.title);
    entry.title = truncate(entry.title, 100);
  }

  if(entry.contentSnippet) {
    // Remove any line breaks
    entry.contentSnippet = entry.contentSnippet.replace(
      GoogleFeedsRequest.BREAK_RULE, '');
    
    // Truncate the snippet
    // NOTE: maybe this should be a parameter, in which case maybe 
    // this function should be defined on the prototype
    // NOTE: this can lead to display bugs because the arbitrary cut off 
    // can cut tags in half
    entry.contentSnippet = truncate(entry.contentSnippet, 400);
  }

  return entry;
};
