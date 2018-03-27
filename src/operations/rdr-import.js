import * as filelib from '/src/lib/file/file.js';
import * as opml_document from '/src/lib/opml-document/opml-document.js';
import * as opml_parser from '/src/lib/opml-parser/opml-parser.js';
import {SubscribeOperation} from '/src/subscribe.js';

export function rdr_import(context, files) {
  const ctx = Object.assign({}, default_context, context);
  ctx.console.log('Importing %d file(s)', files.length);

  const subop = new SubscribeOperation();
  subop.rconn = ctx.rconn;
  subop.iconn = ctx.iconn;
  subop.channel = ctx.channel;
  subop.fetch_timeout = ctx.fetch_timeout;
  subop.notify_flag = false;

  const partial = import_file.bind(ctx, subop);
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

async function import_file(subop, file) {
  if (!file.size) {
    return 0;
  }

  if (!feed_mime_types.includes(file.type)) {
    return 0;
  }

  this.console.debug('Importing file', file.name);

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

  const urls = dedup_urls(opml_document.find_feed_urls(document));
  const promises = urls.map(subop.subscribe, subop);
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
