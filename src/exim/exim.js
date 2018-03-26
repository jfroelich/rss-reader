import * as filelib from '/src/lib/file/file.js';
import * as opml_document from '/src/lib/opml-document/opml-document.js';
import * as opml_parser from '/src/lib/opml-parser/opml-parser.js';
import {feed_peek_url} from '/src/objects/feed.js';
import {get_feeds} from '/src/operations/get-feeds.js';
import {SubscribeOperation} from '/src/subscribe.js';

const feed_mime_types = [
  'application/atom+xml', 'application/rdf+xml', 'application/rss+xml',
  'application/xml', 'application/xhtml+xml', 'text/xml'
];

export function Exim() {
  this.rconn = null;
  this.iconn = null;
  this.channel = null;
  this.fetch_timeout = 2000;
  this.console = null_console;
}

Exim.prototype.import_opml = function(files) {
  if (!(files instanceof FileList)) {
    throw new TypeError('files is not a FileList');
  }

  this.console.log('Importing %d file(s)', files.length);

  const subop = new SubscribeOperation();
  subop.rconn = this.rconn;
  subop.iconn = this.iconn;
  subop.channel = this.channel;
  subop.fetch_timeout = this.fetch_timeout;
  subop.notify_flag = false;

  const partial = this.import_file.bind(this, subop);
  const map = Array.prototype.map;
  const proms = map.call(files, partial);
  return Promise.all(proms);
};

Exim.prototype.import_file = async function(subop, file) {
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
};

const null_console = {
  log: noop,
  debug: noop,
  warn: noop
};

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
