// Google Feeds API - ajax search service wrapper

var googleFeeds = {};

/**
 * Submit a search request to the Google Feeds service. Async.
 * Passes two parameters to callback: query and results. Results
 * is an array of entry objects. The entry object has properties:
 * url, link, contentSnippet, title. url is the feed url. link
 * is the link from the feed. title is from the feed. contentSnippet
 * is a portion of the text from the feed's description.
 * both title and contentSnippet are pre-sanitized html. words from
 * the query are encloded in bold tags.
 *
 * TODO: use error codes instead of strings
 * TODO: strip break tag from snippets before passing to onSuccess
 * TODO: strip or replace '...' and ellipsis charcode from snippets
 *
 * @param query query string
 * @param onSuccess callback for results
 * @param onerror callback for errors
 * @param timeout optional timeout in ms for request
 */
googleFeeds.search = function(query, onSuccess, onError, timeout) {
  
  if(query) {
    query = query.trim();
  }
  
  if(!query) {
    onError('Empty query');
    return;
  }

  if(this.QUERY_MAX_CHARS_ && query.length > this.QUERY_MAX_CHARS_) {
    onError('Query must be 1000 characters or less');
    return;
  }
  
  if(!window.navigator.onLine) {
    onError('Not online');
    return;
  }

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.errorHandler = onError;
  request.successHandler = onSuccess;
  request.onerror = this.onerror_;
  request.ontimeout = this.ontimeout_;
  request.onabort = this.onabort_;
  request.onload = this.onload_;
  
  var url = this.buildRequestURL_(query);
  request.open('GET', url, true);
  request.responseType = 'json';
  request.send();
};

googleFeeds.onload_ = function(event) {
  if(event.target.status != 200) {
    event.target.errorHandler(
      'Invalid response code (' + event.target.status + ' ' + 
        event.target.statusText + ')');
    return;
  }

  var response = event.target.response;

  if(!response) {
    event.target.errorHandler('Missing response');
    return;
  }

  var data = response.responseData;

  if(!data) {
    event.target.errorHandler('Missing response data');
    return;
  }

  googleFeeds.sanitizeEntries_(data.entries);
  event.target.successHandler(data.query, data.entries);
};

googleFeeds.BASE_URL_ = 'https://ajax.googleapis.com/ajax/services/feed/find';
googleFeeds.VERSION_ = '1.0';

// Artificial limit, set to 0 to allow any number of characters
googleFeeds.QUERY_MAX_CHARS_ = 1000;

// Generate the URL for sending a request
googleFeeds.buildRequestURL_ = function(query) {
  return this.BASE_URL_ + '?v='+ this.VERSION_ + 
    '&q=' + encodeURIComponent(query);
};

// Helper that strips some html from entries
googleFeeds.sanitizeEntries_ = function(entries) {
  for(var i = 0, ln = entries.length;i< ln;i++) {
    entries[i].contentSnippet = entries[i].contentSnippet.replace(/<br>/gi,''); 
  }  
};

googleFeeds.onerror_ = function(event) {
  event.target.errorHandler('Error sending request');
};

googleFeeds.onabort_ = function(event) {
  event.target.errorHandler('The request was aborted');
};

googleFeeds.ontimeout_ = function(event) {
  event.target.errorHandler('The request timed out');
};