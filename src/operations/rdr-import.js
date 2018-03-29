import * as filelib from '/src/lib/file/file.js';
import * as opml_parser from '/src/lib/opml-parser/opml-parser.js';
import {rdr_subscribe} from '/src/operations/subscribe.js';

export function rdr_import(context, files) {
  const ctx = Object.assign({}, default_context, context);
  ctx.console.log('Importing %d file(s)', files.length);
  const partial = import_file.bind(ctx);
  const map = Array.prototype.map;
  const proms = map.call(files, partial);
  return Promise.all(proms);
}

const null_console = {
  log: noop,
  debug: noop,
  warn: noop
};

const default_context = {
  rconn: null,
  iconn: null,
  channel: null,
  fetch_timeout: 2000,
  console: null_console
};

const feed_mime_types = [
  'application/atom+xml', 'application/rdf+xml', 'application/rss+xml',
  'application/xml', 'application/xhtml+xml', 'text/xml'
];

async function import_file(file) {
  this.console.debug('Importing file', file.name);

  if (!file.size) {
    return 0;
  }

  if (!feed_mime_types.includes(file.type)) {
    return 0;
  }

  let file_text;
  try {
    file_text = await filelib.read_text(file);
  } catch (error) {
    this.console.debug(error);
    return 0;
  }

  let document;
  try {
    document = opml_parser.parse(file_text);
  } catch (error) {
    this.console.debug(error);
    return 0;
  }

  const urls = dedup_urls(find_feed_urls(document));

  const partial = rdr_subscribe.bind(
      null, this.rconn, this.iconn, this.channel, this.console,
      this.fetch_timeout, false);

  const promises = urls.map(partial);
  const stored_feeds = await Promise.all(promises);
  const count = stored_feeds.reduce((sum, v) => v ? sum : sum + 1, 0);
  this.console.debug('Imported %d feeds from file', count, file.name);
  return count;
}

function noop() {}

function dedup_urls(urls) {
  const unique_urls = [], seen_url_strings = [];
  for (const url of urls) {
    if (!seen_url_strings.includes(url.href)) {
      unique_urls.push(url);
      seen_url_strings.push(url.href);
    }
  }
  return unique_urls;
}

function find_feed_urls(document) {
  const elements = document.querySelectorAll('opml > body > outline');
  const type_pattern = /^\s*(rss|rdf|feed)\s*$/i;
  const urls = [];
  for (const element of elements) {
    const type = element.getAttribute('type');
    if (type_pattern.test(type)) {
      const value = element.getAttribute('xmlUrl');
      if (value) {
        try {
          urls.push(new URL(value));
        } catch (error) {
        }
      }
    }
  }

  return urls;
}
