/**
 * Fetch utilities
 *
 * TODO: create fetchFeedXML function, change everything else to use it
 * it should probably both fetch and parse, i.e. call xml2json or
 * reader.feed.convertXML
 */
var reader = reader || {};
reader.fetch = {};




/**
 * Fetches a webpage. Basically wraps an XMLHttpRequest.
 *
 * TODO: consider an option to embed iframe content
 * TODO: consider an option to auto-sandboxing iframes
 * TODO: consider support for a fallback to plaintext
 * and recharacterizing this as fetchHTMLOrPlaintextDocument or something.
 *
 * Params is object with following properties
 * @param {string} url - the url to fetch
 * @param {function} onload - callback when completed without errors,
 * passed HTMLDocument object as only parameter
 * @param {function} onerror - callback when an error occurs that
 * prevents completion, such as abort, timeout, missing body tag, wrong content type
 * @param {integer} timeout - optional, ms
 * @param {boolean} augmentImageData - if true, will also fetch images
 * and store dimensions as html attributes.
 */
reader.fetch.fetchHTMLDocument = function(params) {
  var self = this;
  var request = new XMLHttpRequest();
  request.timeout = params.timeout;
  request.ontimeout = params.onerror;
  request.onerror = params.onerror;
  request.onabort = params.onerror;
  request.onload = onload;
  request.open('GET', params.url, true);
  request.responseType = 'document';
  request.send();

  function onload(event) {
    var contentType = this.getResponseHeader('content-type');
    if(self.isContentTypeHTML(contentType)) {
      if(this.responseXML && this.responseXML.body) {
        if(params.augmentImageData) {
          self.augmentImageData(this.responseXML, this.responseURL, params.onload);
        } else {
          params.onload(this.responseXML);
        }
      } else {
        params.onerror({type:'invalid-document',target:this});
      }
    } else {
      params.onerror({type:'wrong-content-type',target:this,contentType:contentType});
    }
  }
};

/**
 * Modifies the src attribute of an image element by
 * resolving it according to the baseURL
 *
 * TODO: srcset, picture
 *
 * @imageElement {Element}
 * @baseURL {String}
 */
reader.fetch.resolveImageSource = function(imageElement, baseURL) {
  var source = (imageElement.getAttribute('src') || '').trim();
  if(baseURL && source && !reader.fetch.isDataURI(source)) {
    imageElement.setAttribute('src', URI.resolve(URI.parse(baseURL),
      URI.parse(source)));
  }
};

/**
 * Set dimensions for image elements that are missing dimensions.
 * Passes along the doc to oncomplete. Async.
 *
 * TODO: srcset, picture
 *
 * @param doc {HTMLDocument} an HTMLDocument object to inspect
 * @param baseURL {string} for resolving image urls
 * @param oncomplete {function}
 */
reader.fetch.augmentImageData = function(doc, baseURL, oncomplete) {
  var loadableImages = Array.prototype.filter.call(
    doc.body.getElementsByTagName('img'),
    this.shouldLoadImage);
  var imageLoadedCounter = loadableImages.length;

  if(!loadableImages.length) {
    return oncomplete(doc);
  }

  if(baseURL) {
    loadableImages.forEach(canonicalize);
  }

  loadableImages.forEach(loadImage);

  function canonicalize(image) {
    reader.fetch.resolveImageSource(image, baseURL);
  }

  function loadImage(image) {
    var localImage = document.importNode(image, false);
    localImage.onerror = dispatchIfComplete;
    localImage.onload = onload;
    var src = localImage.src;
    localImage.src = void src;
    localImage.src = src;

    function onload() {
      image.width = this.width;
      image.height = this.height;
      //console.log('W %s H %s', image.width, image.height);
      dispatchIfComplete();
    }
  }

  function dispatchIfComplete() {
    if(--imageLoadedCounter == 0) {
      oncomplete(doc);
    }
  }
};

/**
 * Tests whether an image should be loaded. The basic criteria:
 * - A src url exists
 * - The image is missing width
 * - The src url is not an object URL (data uri).
 *
 * @param image {HTMLImageElement} the element to inspect
 * @return {boolean} true if the image should be loaded
 */
reader.fetch.shouldLoadImage = function(image) {
  var source = (image.getAttribute('src') || '').trim();
  return source && !image.width && !reader.fetch.isDataURI(source);
};

/**
 * Tests whether contentType corresponds to text/html mime type.
 * The test is an informal regex. Content type could contain
 * a full header like text/html;encoding=UTF-8,
 * we just check if it contains 'text/html'. This is not intended
 * to be secure nor 100% accurate.
 *
 * Allows leading spaces, case-insensitive.
 *
 * @param contentType {string} the string to search
 * @return {boolean} true if is text/html mime type
 */
reader.fetch.isContentTypeHTML = function(contentType) {
  return /text\/html/i.test(contentType);
};

/**
 * Tests whether str is a data uri. Only intended to be good enough
 * to avoid issues such as trying to resolve or fetch data uris.
 *
 * NOTE: would be nice if we could check some property of the
 * element containing the url, but I could not find another
 * indicator. element.src always returns a DOMString.
 *
 * NOTE: https://gist.github.com/bgrins/6194623 is helpful
 * @param url {string} the url to test
 * @return {boolean} true if it looks like an object url
 */
reader.fetch.isDataURI = function(url) {
  return /^data:/i.test(url);
};

/**
 * Use Google's feed service to find feed URLs corresponding to a
 * google search query. Async.
 *
 * @param params {object} an object containing props:
 * - query {string} the text query to send to google, assumed defined
 * - oncomplete {function} the callback function to pass query and
 * entries, an array of entry objects from the Google JSON result
 * - onerror {function} the fallback function in case of an error
 * - timeout {integer} optional timeout before giving up, ms
 */
reader.fetch.discoverFeeds = function(params) {
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
    var data = this.response.responseData;
    data.entries.forEach(function(entry) {
      entry.contentSnippet = util.stripBRs(entry.contentSnippet);
    });
    oncomplete(data.query, data.entries);
  };

  //console.log('discoverFeeds requestURL %s', requestURL);

  request.open('GET', requestURL, true);
  request.responseType = 'json';
  request.send();
};

/**
 * Returns a URL string pointing to the fav icon for a url. If url is
 * undefined/empty, the locally stored default fav icon url is returned
 * instead.
 *
 * NOTE: Currently this is sync and does not use some type of
 * remote service, but it might in the future be refactored to use
 * a callback that is called async.
 *
 * NOTE: chrome://favicons/url only works for urls present in
 * history, so it is useless.
 *
 * @param url {string} the url of a webpage for which to find the
 * corresponding fav icon.
 * @return {string} the url of the favicon
 */
reader.fetch.getFavIconURL = function(url) {
  var GOOGLE_BASE_URL = 'http://www.google.com/s2/favicons?domain_url=';
  var FALLBACK_URL = '/media/rss_icon_trans.gif';
  return url ?  GOOGLE_BASE_URL + encodeURIComponent(url) : FALLBACK_URL;
};