// See license.md

'use strict';

{

function fetchHTML(requestURL, log, callback) {
  log.log('Fetching html of url', requestURL.href);
  const ctx = {
    'requestURL': requestURL,
    'responseURL': null,
    'callback': callback,
    'log': log
  };

  const opts = {};
  opts.credentials = 'omit';
  opts.method = 'GET';
  opts.headers = {'Accept': 'text/html'};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';

  const boundOnResponse = onResponse.bind(ctx);
  const boundOnError = onError.bind(ctx);
  fetch(requestURL.href, opts).then(boundOnResponse).catch(boundOnError);
}

function onResponse(response) {
  this.log.debug('Response status:', response.status);
  if(!response.ok) {
    this.callback({'type': 'error'});
    return;
  }
  this.responseURL = new URL(response.url);
  response.text().then(onReadText.bind(this));
}

function onReadText(text) {
  this.log.debug('Response text length:', text.length);

  let doc = null;
  const parser = new DOMParser();
  try {
    doc = parser.parseFromString(text, 'text/html');
  } catch(error) {
    this.callback({'type': 'parseerror'});
    return;
  }

  if(!doc || !doc.documentElement) {
    this.callback({'type': 'parseerror'});
    return;
  }

  if(doc.documentElement.localName !== 'html') {
    this.callback({'type': 'parseerror'});
    return;
  }

  this.callback({'type': 'success', 'document': doc,
    'responseURL': this.responseURL});
}

function onError(error) {
  this.log.debug(error);
  this.callback({'type': 'error'});
}

this.fetchHTML = fetchHTML;

}
