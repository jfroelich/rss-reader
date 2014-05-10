// Lib for fetching feeds
// TODO: can i send a header that limits it to text/xml? Acccepts or something?

var ALLOWED_MIME_TYPES = [
  'application/atom+xml',
  'application/rdf+xml',
  'application/rss+xml',
  'application/xml',
  'text/xml'
];

// Fetch an XML file (async)
function fetchFeed(url, onSuccess, onError, timeout) {
  var request = new XMLHttpRequest();
  request.timeout = timeout;

  request.addEventListener('error', function(event) {
    onError('The request to "'+url+'" encountered an unknown error.');
  });

  request.addEventListener('abort', function(event) {
    onError('The request to "' + url + '" was aborted.');
  });

  request.addEventListener('timeout', function(event) {
    onError('The request to "' + url + '" timed out.');
  });

  request.addEventListener('load', function(event) {

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

  request.open('GET', url, true);
  request.responseType = 'document';

  // Must be called after open and before send
  //request.setRequestHeader('Accept:', 'asdf')

  request.send();
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