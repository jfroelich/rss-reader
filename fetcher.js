// Lib for fetching feeds
// TODO: can i send a header that limits it to text/xml? Acccepts or something?

var ALLOWED_MIME_TYPES = [
  'application/atom+xml',
  'application/rdf+xml',
  'application/rss+xml',
  'application/xml',
  'text/xml'
];

// Asynchronously fetch an XML file
function fetchFeed(url, onSuccess, onError, timeout) {
  var abortTimer = 0;
  var timeoutOccurred = false;
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'document';

  // Must be called after open and before send
  //request.setRequestHeader('Accept:', 'asdf')

  // 'timeout' in new XMLHttpRequest() returns "true" in console
  // consider using it
  // request.timeout = timeout;
  // request.ontimeout = function(event) {'ontimeout'};

  request.addEventListener('error', function(event) {
    clearTimeout(abortTimer);

    // Chrome whines about accessing event.target.responseText
    // when event.target.responseType is document.
    onError('The request to "'+url+'" encountered an unknown error.');
  });

  request.addEventListener('abort', function(event) {
    clearTimeout(abortTimer);
    
    if(timeoutOccurred) {
      onError('The request to "' + url + '" timed out.');
    } else {
      onError('The request to "' + url + '" was aborted.');  
    }
  });

  request.addEventListener('load', function(event) {
    clearTimeout(abortTimer);
    
    if(event.target.status != 200) {
      onError('The request to "'+ url+
        '" returned an invalid response code (' + 
        event.target.status + ').');
      return;
    }

    var type = (event.target.getResponseHeader('Content-Type') || '').toLowerCase();
    if(!isAllowedMimeType(type)) {
      onError('The request to "'+ url+
        '" did not return a valid content type ('+type+').');
      return;
    }

    if(!event.target.responseXML) {
      onError('The request to "'+ url+
        '" did not return an XML document.');
      return;
    }

    if(!event.target.responseXML.documentElement) {
      onError('The request to "'+ url+
        '" did not return a valid XML document (no document element found).');
      return;
    }

    onSuccess(event.target.responseXML);
  });

  request.send();

  if(timeout) {
    abortTimer = setTimeout(function() {
      if(request && request.readyState < XMLHttpRequest.DONE) {
        timeoutOccurred = true;
        request.abort();
      }
    }, timeout);
  }
}

function isAllowedMimeType(type) {
  if(type) {
    for(var i = 0; i < ALLOWED_MIME_TYPES.length;i++) {
      if(type.lastIndexOf(ALLOWED_MIME_TYPES[i], 0) === 0) {
        return true;
      }
    }
  }
}