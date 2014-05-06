// Fetch lib

// Asynchronously fetches an XML file
function fetchFeed(url, callback, timeout) {
  var abortTimer = 0;
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'document';
  request.onerror = fetchOnError(abortTimer, callback);
  request.onabort = fetchOnAbort(url, abortTimer, callback);
  request.onload = fetchOnLoad(url, abortTimer, callback);

  try {
    request.send();
  } catch(exception) {
    console.log('Fetch exception %s', exception);
    if(request) {
      request.abort();
    }
  }

  if(timeout) {
    abortTimer = setTimeout(fetchTriggerAbort(request), timeout);
  }
}

function fetchOnAbort(url, abortTimer, callback) {
  return function(event) {
    clearTimeout(abortTimer);
    callback({'error': 'The request to \'' + url + '\' was aborted or timed out.'});
  };
}

function fetchOnError(abortTimer, callback) {
  return function(event) {
    clearTimeout(abortTimer);
    callback({'error': event});
  };
}

function fetchOnLoad(url, abortTimer, callback) {
  return function(event) {

    clearTimeout(abortTimer);
    
    var response = event.target;
    if(response.status != 200 || !response.responseXML ||
      !response.responseXML.documentElement) {

      callback({'error': 'Invalid response for '+ url+'. Status was ' + response.status});
      return;
    }

    callback(response.responseXML);
  };
}


function fetchTriggerAbort(request) {
  return function() {
    if(request && request.readyState < XMLHttpRequest.DONE) {
      request.abort();
    }
  };
}