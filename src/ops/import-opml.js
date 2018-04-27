import {console_stub} from '/src/lib/console-stub.js';
import {read_text as read_file_text} from '/src/lib/file.js';
import {parse as parse_opml} from '/src/lib/opml-parser.js';
import {subscribe} from '/src/ops/subscribe.js';

const opml_mime_types = [
  'application/xml', 'application/xhtml+xml', 'text/xml', 'text/x-opml',
  'application/opml+xml'
];

// TODO: rather than resolve to array of counts, I could just resolve to array
// of arrays of feed objects. Then import_file does not need async qualifier
// and doesn't need to await subscribe, and this whole operation basically just
// becomes a spawner of subscribe promises? But I need to await the file i/o,
// so that is not quite right.

export function import_opml(file_list) {
  this.console.log(
      '%s: importing %d file(s)', import_opml.name, file_list.length);
  // FileList does not support map so use array.map.call
  const map = Array.prototype.map;
  const import_promises = map.call(file_list, import_file, this);
  return Promise.all(import_promises);
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
    file_text = await read_file_text(file);
  } catch (error) {
    this.console.debug(error);
    return 0;
  }

  let document;
  try {
    document = parse_opml(file_text);
  } catch (error) {
    this.console.debug(error);
    return 0;
  }

  const urls = dedup_urls(find_feed_urls(document));
  const feeds = await subscribe_urls.call(this, urls);
  const count = feeds.reduce((sum, v) => v ? sum : sum + 1, 0);
  this.console.debug(
      '%s: imported %d feeds from %s', import_file.name, count, file.name);
  return count;
}

function subscribe_urls(urls) {
  const op = {};
  op.rconn = this.rconn;
  op.iconn = this.iconn;
  op.channel = this.channel;
  op.console = this.console;
  op.subscribe = subscribe;

  const options = {fetch_timeout: this.fetch_timeout, notify: false};

  const promises = [];
  for (const url of urls) {
    promises.push(op.subsribe(url, options));
  }

  return Promise.all(promises);
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
      const url_string = element.getAttribute('xmlUrl');
      if (url_string) {
        try {
          // TODO: does opml support a base url that i should be considering
          // here?
          urls.push(new URL(url_string));
        } catch (error) {
        }
      }
    }
  }

  return urls;
}
