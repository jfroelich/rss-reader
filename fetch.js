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
 * Tests whether an image should be loaded
 */
reader.fetch.shouldLoadImage = function(image) {
  var source = (image.getAttribute('src') || '').trim();
  return source && !image.width && !reader.fetch.isDataURI(source);
};

reader.fetch.isContentTypeHTML = function(contentType) {
  return /text\/html/i.test(contentType);
};

/**
 * Tests whether str is a data uri. This is not meant to be perfect,
 * just good enough to avoid issues with like trying to resolve or
 * fetch data uris
 * NOTE: https://gist.github.com/bgrins/6194623 is helpful
 * @param url {string} the url to test
 */
reader.fetch.isDataURI = function(url) {
  return /^data:/i.test(url);
};