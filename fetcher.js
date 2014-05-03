// Fetches a remote xml file 
// and returns it as a parsed feed object to the callback

var fetcher = {};

// Fetches a feed and pass it to the callback
fetcher.fetchFeed = function(url, callback, timeout) {
 
  var request = new XMLHttpRequest();

  request.open('GET', url, true);
  
  request.responseType = 'document';

  request.onerror = function(event) {
    clearTimeout(fetcher.abortTimer);
    callback({'error': event});
  };

  request.onabort = function(event) {
    clearTimeout(fetcher.abortTimer);
    callback({'error': 'The request to \'' + url + '\' was aborted or timed out.'});
  };

  request.onload = function(event) {

    var response = event.target;
    
    // Got a response so stop checking for timeout
    clearTimeout(fetcher.abortTimer);

    if(response.status != 200 || !response.responseXML ||
      !response.responseXML.documentElement) {

      callback({'error': 'Invalid response for '+ url+'. Status was ' + response.status});
      return;
    }

    var result = feedParser.parseXML(response.responseXML);

    // Expose the requested URL
    result.url = url;
 
    callback(result);
  };

  try {
    request.send();
  } catch(exception) {
    console.log('Fetcher exception %s', exception);
    if(request) {
      request.abort();
    }
  }
  
  if(timeout) {
    fetcher.abortTimer = setTimeout(function() {
      if(request && request.readyState < XMLHttpRequest.DONE) {
        request.abort();
      }
    }, timeout);
  }
}