/**
 * HTTP related
 */


/**
 * Fetches a webpage. Basically wraps an XMLHttpRequest.
 *
 *
 * TODO: should we notify the callback of responseURL (is it
 * the url after redirects or is it the same url passed in?). i think
 * the onload callback should also receive responseURL. maybe onerror
 * should also receive responseURL if it is defined. that way the caller
 * can choose to also replace the original url
 * TODO: consider support for a fallback to plaintext
 * and recharacterizing this as fetchHTMLOrPlaintextDocument or something.
 * TODO: could this pass the xhr along instead of HTMLDocument? it works in
 * the normal case because caller ust accesses responseXML, but what about
 * if we provide the plaintext fallback?
 * TODO: consider an option to embed iframe content
 * TODO: consider an option to auto-sandboxing iframes
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
function fetchHTMLDocument(params) {
  var self = this;
  var request = new XMLHttpRequest();
  request.timeout = params.timeout;
  request.ontimeout = params.onerror;
  request.onerror = params.onerror;
  request.onabort = params.onerror;
  request.onload = onHTMLDocumentLoad;
  request.open('GET', params.url, true);
  request.responseType = 'document';
  request.send();

  function onHTMLDocumentLoad(event) {

    // TEMP: learning about responseURL
    if(this.responseURL != params.url) {
      console.log('originalURL %s responseURL %s', params.url, this.responseURL);
    }

    var contentType = this.getResponseHeader('content-type');
    if(isContentTypeHTML(contentType)) {
      if(this.responseXML && this.responseXML.body) {
        if(params.augmentImageData) {
          augmentImageData(this.responseXML, this.responseURL, params.onload);
        } else {
          params.onload(this.responseXML);
        }
      } else {
        params.onerror({type:'invalid-document',target:this});
      }
    } else {
      params.onerror({type:'invalid-content-type',target:this,contentType:contentType});
    }
  }
}

/**
 * Set dimensions for image elements that are missing dimensions.
 * Passes along the doc to oncomplete. Async.
 *
 * TODO: srcset, picture
 * TODO: could this just accept an xhr instead of doc + baseURL?
 * is that better or worse?
 *
 * @param doc {HTMLDocument} an HTMLDocument object to inspect
 * @param baseURL {string} for resolving image urls
 * @param oncomplete {function}
 */
function augmentImageData(doc, baseURL, oncomplete) {

  // Get an array of only loadable images
  var filter = Array.prototype.filter;
  var allBodyImages = doc.body.getElementsByTagName('img');
  var loadableImages = filter.call(allBodyImages, function(image) {
    var source = (image.getAttribute('src') || '').trim();
    return source && !image.width && !isDataURI(source);
  });

  var numImagesToLoad = loadableImages.length;

  if(!numImagesToLoad) {
    return oncomplete(doc);
  }

  loadableImages.forEach(function(image) {

    var source = (image.getAttribute('src') || '').trim();

    // TODO: we could parse baseURL only once
    if(baseURL) {
      image.setAttribute('src',resolveURI(parseURI(baseURL), parseURI(source)));
    }

    // Image may be alien (e.g. from responseXML), so import. Also,
    // because nothing happens when setting src of a element that
    // has never been attached to the live document.
    var localImage = document.importNode(image, false);
    localImage.onerror = dispatchIfComplete;
    localImage.onload = onload;

    // Prevent webkit from suppressing change
    var src = localImage.src;
    localImage.src = void src;
    localImage.src = src;

    function onload() {
      image.width = this.width;
      image.height = this.height;
      //console.log('W %s H %s', image.width, image.height);
      dispatchIfComplete();
    }
  });

  function dispatchIfComplete() {
    if(--numImagesToLoad == 0) {
      oncomplete(doc);
    }
  }
}

/**
 * Tests whether the contentType contains a feed-like mimetype. Not
 * very strict.
 *
 * Matches application/xml, text/xml, application/atom+xml,
 * application/rdf+xml, application/rss+xml.
 *
 * TODO: use reader.mime.isContentTypeFeed for this and similar
 * functions?
 *
 * @param contentType {string} the content type string to search, which
 * could be a full raw header string
 * @return {boolean} true if contentType contained a feed-like mime type
 */
function isContentTypeFeed(contentType) {
  return /(application|text)\/(atom|rdf|rss)?\+?xml/i.test(contentType);
}

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
function isContentTypeHTML(contentType) {
  return /text\/html/i.test(contentType);
}

function isContentTypeText(contentType) {
  return /text\/plain/i.test(contentType);
}

/**
 * Tests whether contentType corresponds to text/plain mime type,
 * or the text/html type.
 *
 * TODO: i think i should deprecate this and force caller to
 * use 2 conditions? it means 2 regexes which is slower, but
 * it is looser coupling?
 *
 * @param contentType {string}
 * @return {boolean} true if text/plain
 */
function isContentTypeHTMLOrText(contentType) {
  return /text\/(plain|html)/i.test(contentType);
}
