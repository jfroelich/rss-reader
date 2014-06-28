/**
 * Tools for searching the Internet for feeds to subscribe to.
 */
var discover = {};

/**
 * Search for feeds. For now this just proxies
 * queryGoogleFeeds.
 */
discover.queryFeeds = function(params) {
  discover.queryGoogleFeeds(params);
};



/**
 * Use Google's find feed service to find feed URLs corresponding to a
 * google search query.
 *
 * @param params {object} an object containing props:
 * - query {string} the text query to send to google, assumed defined
 * - oncomplete {function} the callback function to pass query and
 * entries, an array of entry objects from the Google JSON result
 * - onerror {function} the fallback function in case of an error
 * - timeout {integer} optional timeout before giving up, ms
 */
discover.queryGoogleFeeds = function(params) {
  var oncomplete = params.oncomplete || util.noop;
  var onerror = params.onerror || util.noop;
  var query = (params.query || '').trim();
  var timeout = params.timeout || 0;

  // NIT: declare constants as properties of reader.fetch in uppercase?
  var baseURL = 'https://ajax.googleapis.com/ajax/services/feed/find';
  var apiVersion = '1.0';
  var requestURL = baseURL + '?v=' + apiVersion + '&q=' + encodeURIComponent(query);

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onerror;
  request.ontimeout = onerror;
  request.onabort = onerror;

  request.onload = function(event) {

    console.log('got %o from google feeds for query %s', this, query);

    var data = this.response.responseData;
    data.entries.forEach(function(entry) {
      entry.contentSnippet = strings.stripBRs(entry.contentSnippet);
    });
    oncomplete(data.query, data.entries);
  };

  //console.log('discoverFeeds requestURL %s', requestURL);

  request.open('GET', requestURL, true);
  request.responseType = 'json';
  request.send();
};