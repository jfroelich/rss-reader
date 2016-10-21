// See license.md

'use strict';

{

function fetch_xml(req_url, log, callback) {
  if(!parse_xml)
    throw new ReferenceError();
  log.log('Fetching XML file', req_url.toString());
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
  ctx.req_url = req_url;
  ctx.log = log;
  ctx.last_modified_date = null;
  ctx.response_url = null;
  fetch(req_url.href, opts).then(on_response.bind(ctx)).catch(
    on_error.bind(ctx));
}

function on_response(response) {
  this.log.debug('Status:', response.status);
  if(!response.ok) {
    this.log.debug('Not OK');
    this.callback({'type': 'neterr'});
    return;
  }

  // Try to not accept invalid mime types
  const type = response.headers.get('Content-Type');
  this.log.debug('Type:', type);
  if(type) {
    const norm_type = type.toLowerCase();
    if(!norm_type.includes('xml') && !norm_type.includes('text/html')) {
      this.log.debug(req_url.href, 'invalid type', type);
      this.callback({'type': 'typeerror'});
      return;
    }
  }

  this.response_url = response.url;
  const last_mod = response.headers.get('Last-Modified');
  if(last_mod) {
    this.log.debug('Last modified:', last_mod);
    try {
      this.last_modified_date = new Date(last_mod);
    } catch(error) {
      this.log.warn(error);
    }
  }

  response.text().then(on_read_text.bind(this));
}

function on_read_text(text) {
  this.log.debug('Read text of %s (%s characters)', this.req_url.href,
    text.length);
  let doc = null;
  try {
    doc = parse_xml(text);
  } catch(error) {
    this.log.debug(this.req_url.href, error);
    this.callback({'type': 'parsererror', 'error': error});
    return;
  }

  this.log.debug('Document element:', doc.documentElement.nodeName);
  const event = {
    'type': 'success',
    'document': doc,
    'responseURLString': this.response_url,
    'lastModifiedDate': this.last_modified_date
  };
  this.callback(event);
}

function on_error(error) {
  this.log.debug(this.req_url.href, error);
  this.callback({'type': 'error'});
}

this.fetch_xml = fetch_xml;

}
