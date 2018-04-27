import {console_stub} from '/src/lib/console-stub.js';
import * as filelib from '/src/lib/file.js';
import * as opml_parser from '/src/lib/opml-parser.js';
import {subscribe} from '/src/ops/subscribe.js';

const opml_mime_types = [
  'application/xml', 'application/xhtml+xml', 'text/xml', 'text/x-opml',
  'application/opml+xml'
];

// Required context properties:
// rconn
// iconn
// channel
// fetch_timeout
// console

export function import_opml(file_list) {
  this.console.log(
      '%s: importing %d file(s)', import_opml.name, file_list.length);
  // file_list is type FileList, not array, cannot use list.map directly
  const map = Array.prototype.map;
  const promises = map.call(file_list, import_file, this);
  return Promise.all(promises);
}

async function import_file(file) {
  this.console.debug(
      '%s: name %s size %d type %s', import_file.name, file.name, file.size,
      file.type);

  if (!file.size) {
    return 0;
  }

  if (!opml_mime_types.includes(file.type)) {
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

  const sub_op = {};
  sub_op.rconn = this.rconn;
  sub_op.iconn = this.iconn;
  sub_op.channel = this.channel;
  sub_op.console = this.console;
  sub_op.subscribe = subscribe;
  const sub_opts = {fetch_timeout: this.fetch_timeout, notify: false};

  const promises = [];
  for (const url of urls) {
    promises.push(sub_op.subsribe(url, sub_opts));
  }

  const stored_feeds = await Promise.all(promises);
  const count = stored_feeds.reduce((sum, v) => v ? sum : sum + 1, 0);
  this.console.debug(
      '%s: imported %d feeds from file', import_file.name, count, file.name);
  return count;
}

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
