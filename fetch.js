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
 * Fetches the XML for a feed from a URL, then parses it into
 * a javascript object, and passes this along to a callback. If an error
 * occurs along the way, calls an error callback instead. Async.
 *
 * For each entry, it checks if the entry has a link. If the entry has
 * a link, this also sends subsequent requests to get the full html
 * of the link and uses that instead of the entry.content property that
 * was provided from within the xml feed.
 *
 * NOTE: onerror could be passed an XMLHttpRequest event containing an error,
 * an exception, a string, or a custom object
 * NOTE: unlike old API, oncomplete is not always called, onerror is called instead
 * so make note of that there are now two exit points not one with a possible
 * side effect.
 *
 * TODO: separate timeout for feed fetch and web page fetch
 * TODO: option to fetch/not fetch webpages instead of always fetch
 * TODO: util.parseXML should be moved elsewhere, so this will need to change
 * TODO: formalize/standardize the parameter to onerror?
 *
 * @param params {object} an object literal that should contain props:
 * - url the remote url of the feed to fetch
 * - oncomplete - a callback to call when the feed is fetched, that is passed
 * a javascript object representing the contents of the feed
 * - onerror - a callback to call in case of an error, that is called instead
 * of oncomplete
 * - timeout - optional timeout before giving up on feed (or web pages)
 * - augmentEntries - if true, fetches full content of entry.link and
 * uses that instead of the feed content
 * - augmentImageData - augment image data in fetched web pages
 * - rewriteLinks - if true, entry.link values are rewritten in the feed
 * prior to fetching or checking if already fetched in db
 * - entryTimeout - optional timeout before giving up on fetching webpage for entry
 */

reader.fetch.fetchFeed = function(params) {
  var url = (params.url || '').trim();
  var oncomplete = params.oncomplete || util.noop;
  var onerror = params.onerror || util.noop;
  var timeout = timeout;
  var isFeed = this.isContentTypeFeed;
  var isHTMLOrText = this.isContentTypeHTMLOrText;
  var augmentImageData = params.augmentImageData;
  var augmentEntries = params.augmentEntries;
  var rewriteLinks = params.rewriteLinks;

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onerror;
  request.ontimeout = onerror;
  request.onabort = onerror;
  request.onload = onFeedLoaded;
  request.open('GET', url, true);
  request.send();

  // Gets the xml from the response and handoffs to createFeedFromXML
  // or onerror
  function onFeedLoaded() {
    // TODO: does getResponseHeader ever return undefined?
    // TODO: does case matter?
    // TODO: should we parse out mime type?
    var contentType = this.getResponseHeader('Content-Type') || '';

    if(isFeed(contentType)) {
      if(this.responseXML && this.responseXML.documentElement) {
        createFeedFromXML(this.responseXML);
      } else {
        onerror({type:'invalid-xml',target:this});
      }
    } else if(isHTMLOrText(contentType)) {
      try {
        var xmlDocument = util.parseXML(this.responseText);
      } catch(e) {
        return onerror(e);
      }

      if(xmlDocument && xmlDocument.documentElement) {
        createFeedFromXML(xmlDocument);
      } else {
        onerror({type:'invalid-xml',target:this});
      }
    } else {
      onerror({type:'invalid-content-type',target:this});
    }
  }

  function createFeedFromXML(feedXML) {
    try {
      var feed = xml2json.transform(feedXML);
    } catch(e) {
      return onerror(e);
    }

    if(!feed.entries.length) {
      return oncomplete(feed);
    }

    var fetchableEntries = feed.entries.filter(reader.feeds.entryHasLink);
    var numEntriesToProcess = fetchableEntries.length;
    if(numEntriesToProcess == 0) {
      return oncomplete(feed);
    }

    if(rewriteLinks) {
      fetchableEntries.forEach(reader.feeds.rewriteEntryLink);
    }

    // In order to ensure consistent storage of entry.link values,
    // this check for whether to augment does not occur until after
    // entries with links have been possibly rewritten.
    if(!augmentEntries) {
      return oncomplete(feed);
    }

    // The following needs revision and just outright better design
    // We have some urls to fetch. But we don't want to fetch
    // for entries that are already stored in the database, sort of. It would
    // be nice to do things like retry later fetching.
    // TODO: this should be per feed, not across all entries, otherwise
    // if two feeds link to the same article, only the first gets augmented.
    // need to use something like findEntryByFeedIdAndLinkURL that uses
    // a compound index

    model.connect(function(db) {
      fetchableEntries.forEach(function(entry) {
        reader.storage.findEntryByLinkURL(db, entry.link, function(existingEntry) {
          if(existingEntry) {
            dispatchIfComplete();
          } else {
            augmentEntry(entry);
          }
        });
      });
    });

    function augmentEntry(entry) {
      reader.fetch.fetchHTMLDocument({
        augmentImageData: augmentImageData,
        url: entry.link,
        onload: function(doc) {
          var html = doc.body.innerHTML;
          if(html)
            entry.content = html;
          dispatchIfComplete();
        },
        onerror: function(error) {
          console.log(error);
          dispatchIfComplete();
        },
        timeout: entryTimeout
      });
    }

    function dispatchIfComplete() {
      if(--numEntriesToProcess == 0) {
        oncomplete(feed);
      }
    }
  }
};


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

    // TEMP: learning about responseURL
    if(this.responseURL != params.url) {
      console.log('originalURL %s responseURL %s', params.url, this.responseURL);
    }

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
      params.onerror({type:'invalid-content-type',target:this,contentType:contentType});
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
 * TODO: could this just accept an xhr instead of doc + baseURL ?
 * is that better or worse?
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
reader.fetch.isContentTypeFeed = function(contentType) {
  return /(application|text)\/(atom|rdf|rss)?\+?xml/i.test(contentType);
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

reader.fetch.isContentTypeText = function(contentType) {
  return /text\/plain/i.test(contentType);
};

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
reader.fetch.isContentTypeHTMLOrText = function(contentType) {
  return /text\/(plain|html)/i.test(contentType);
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
 * NOTE: chrome://favicons/url only works for urls present in
 * history, so it is useless.
 * TODO: this should be using a callback, to allow for more seamless
 * transition to async service call.
 * TODO: support offline. right now this returns a remote url which
 * then causes images to not load later if offline.
 * TODO: this is should be refactored to look more like a wrapper call
 * to a service from which urls are fetched. After all this is partly
 * why this function is put in the fetch namespace.
 * TODO: does it matter whether we use http or https?
 * TODO: does fetching involve CORS issues or need to change manifest
 * or similar issues? If I ever want to stop using all_urls, the
 * URLs used here would maybe need to be explicit in manifest?
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