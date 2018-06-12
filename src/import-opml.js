import {parse_opml} from '/src/lib/parse-opml.js';
import {subscribe} from '/src/subscribe.js';

// Concurrently reads in the files from the file list and subscribes to the
// feeds in all of the files. Returns a promise that resolves to an array of
// subscribe promise results. The input file list is not modified.
// Expected context properties: rconn, iconn, channel
// @param files {array-like} an array-like collection of file objects, such as
// a FileList, or an array
export async function import_opml(
    rconn, iconn, channel, files, fetch_timeout, skip_icon_lookup) {
  const subscribe_promises = [];
  const import_file_promises = [];
  for (const file of files) {
    const import_file_promise = import_file(
        subscribe_promises, rconn, iconn, channel, file, fetch_timeout,
        skip_icon_lookup);
    const catch_promise = import_file_promise.catch(console.warn);
    import_file_promises.push(catch_promise);
  }

  // Wait for all import file promises to settle to ensure that we spawned all
  // of the subscribe promises from each file. Note that we only wait until
  // those promises are spawned, not settled.
  await Promise.all(import_file_promises);

  // Construct and return a promise that settles when all of the subscribe
  // promises settle
  return Promise.all(subscribe_promises);
}


// Reads a file, parses its contents, finds all feeds in the parsed file, and
// then spawns subscribe promises for all feeds in the file. Returns prior to
// the susbcribe promises settling. A reference to each subscribe promise is
// pushed to the promises array so that they can be awaited at the caller's
// choosing. This does check before spawning a subscribe promise that a similar
// feed url does not exist in the file, but it does not check if a similar feed
// url exists from promises that existed in the array prior to calling. This
// does not check if an equivalent subscribe promise already exists in the
// array, so if used concurrently there could be dupe promises. When there is
// more than one concurrent subscribe operation to the same feed, one will
// eventually succeed and the rest will fail.
async function import_file(
    subscribe_promises, rconn, iconn, channel, file, fetch_timeout,
    skip_icon_lookup) {
  // Not an error. Just noop.
  if (!file.size) {
    return;
  }

  // Tried to import a non-opml file. Error
  if (!file_is_opml(file)) {
    throw new Error(
        'Unaccepted mime type ' + file.type + ' for file ' + file.name);
  }

  // If any i/o error occurs, rethrow it
  const file_text = await file_read_text(file);
  // If any parse error occurs, rethrow it
  const document = parse_opml(file_text);

  const urls = dedup_urls(find_feed_urls(document));

  // Create subscribe promises for each of the urls. Use promise.catch to
  // suppress errors to avoid any one subscription error causing the entire
  // import to fail when later using Promise.all on the promises array.
  const should_notify = false;
  for (const url of urls) {
    const subscribe_promise = subscribe(
        rconn, iconn, channel, url, fetch_timeout, should_notify,
        skip_icon_lookup);
    const catch_promise = subscribe_promise.catch(e => console.warn(e));
    subscribe_promises.push(catch_promise);
  }
}

// Return a new array of distinct URLs. The output array is always defined.
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

// Searches the nodes of the document for feed urls. Returns an array of URL
// objects (not strings). Never returns undefined.
function find_feed_urls(document) {
  // Using the descendant selector to try and be somewhat strict here. Really
  // the strictness does not matter too much but I want to use some semblance of
  // the ideal approach without going as far as explicit tree walking.
  const elements = document.querySelectorAll('opml > body > outline');

  const type_pattern = /^\s*(rss|rdf|feed)\s*$/i;
  const urls = [];
  for (const element of elements) {
    const type = element.getAttribute('type');
    if (type_pattern.test(type)) {
      const url_string = element.getAttribute('xmlUrl');
      if (url_string) {
        try {
          urls.push(new URL(url_string));
        } catch (error) {
        }
      }
    }
  }

  return urls;
}

function file_is_opml(file) {
  const opml_mime_types = [
    'application/xml', 'application/xhtml+xml', 'text/xml', 'text/x-opml',
    'application/opml+xml'
  ];
  return opml_mime_types.includes(file.type);
}

function file_read_text(file) {
  return new Promise(function executor(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = _ => resolve(reader.result);
    reader.onerror = _ => reject(reader.error);
  });
}
