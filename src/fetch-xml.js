// See license.md

'use strict';

{

function fetchXML(requestURL, log, callback) {
  if(!parseXML) {
    throw new ReferenceError('parseXML');
  }

  log.log('Fetching XML file', requestURL.toString());

  const accepts = [
    'application/rss+xml',
    'application/rdf+xml',
    'application/atom+xml',
    'application/xml;q=0.9',
    'text/xml;q=0.8'
  ].join(', ');

  const opts = {};
  opts.credentials = 'omit';// no cookies
  opts.method = 'GET';
  opts.headers = {'Accept': accepts};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';

  const ctx = {};
  ctx.callback = callback;
  ctx.requestURL = requestURL;
  ctx.log = log;
  ctx.lastModifiedDate = null;
  ctx.responseURL = null;

  fetch(requestURL.href, opts).then(onResponse.bind(ctx)).catch(
    onError.bind(ctx));
}

function onResponse(response) {
  this.log.debug('Status:', response.status);

  if(!response.ok) {
    this.log.debug('Not OK');
    this.callback({'type': 'neterr'});
    return;
  }

  const type = response.headers.get('Content-Type');
  this.log.debug('Type:', type);
  if(!isAcceptedType(type)) {
    this.log.debug(requestURL.href, 'invalid type', type);
    this.callback({'type': 'typeerror'});
    return;
  }

  this.responseURL = response.url;
  const lastModified = response.headers.get('Last-Modified');
  if(lastModified) {
    this.log.debug('Last modified:', lastModified);
    try {
      this.lastModifiedDate = new Date(lastModified);
    } catch(error) {
      this.log.warn(error);
    }
  }

  response.text().then(onReadText.bind(this));
}

function onReadText(text) {
  this.log.debug('Character count:', text.length);

  let doc = null;
  try {
    doc = parseXML(text);
  } catch(error) {
    this.log.debug(this.requestURL.href, error);
    this.callback({'type': 'parsererror', 'error': error});
    return;
  }

  this.log.debug('Document element:', doc.documentElement.nodeName);

  const event = {
    'type': 'success',
    'document': doc,
    'responseURLString': this.responseURL,
    'lastModifiedDate': this.lastModifiedDate
  };
  this.log.debug('Success event:', event);
  this.callback(event);
}

function onError(error) {
  this.log.debug(this.requestURL.href, error);
  this.callback({'type': 'error'});
}

// Checks the request header value and returns true if xml or html
// @param type {String} the raw header string for 'Content-Type'
function isAcceptedType(type) {
  // Treat missing content type as unacceptable
  if(!type) {
    return false;
  }

  // The header value may contain the charset so use a more general test.
  // Restrict to xml but allow for html for non-conforming responses
  const str = type.toLowerCase();
  return str.includes('xml') || str.includes('text/html');
}

this.fetchXML = fetchXML;

}
