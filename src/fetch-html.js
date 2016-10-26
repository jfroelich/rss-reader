// See license.md

'use strict';

// TODO: return a promise
// TODO: use async

{

function fetch_html(req_url, log, callback) {
  log.log('Fetching html of url', req_url.href);
  const ctx = {
    'req_url': req_url,
    'response_url': null,
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

  const bound_on_response = on_response.bind(ctx);
  const bound_on_error = on_error.bind(ctx);
  fetch(req_url.href, opts).then(bound_on_response).catch(bound_on_error);
}

// TODO: look into possible bug, response.status===404 does mean response.ok
// is false, but I am acting like it is? Because I am seeing that the response
// text is being read in case of a 404 (i think)

function on_response(response) {
  this.log.debug('Response status:', response.status);
  if(!response.ok) {
    this.callback({'type': 'error'});
    return;
  }
  this.response_url = new URL(response.url);
  response.text().then(on_read_text.bind(this));
}

function on_read_text(text) {
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
    'responseURL': this.response_url});
}

function on_error(error) {
  this.log.debug(error);
  this.callback({'type': 'error'});
}

this.fetch_html = fetch_html;

}
