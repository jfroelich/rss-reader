import {parse_opml} from '/src/lib/parse-opml.js';
import {log} from '/src/log.js';
import {subscribe} from '/src/subscribe.js';

// Supported opml file mime types
const opml_mime_types = [
  'application/xml', 'application/xhtml+xml', 'text/xml', 'text/x-opml',
  'application/opml+xml'
];

// Concurrently reads in the files from the file list and subscribes to the
// feeds in all of the files. Returns a promise that resolves to an array of
// subscribe promise results. The input file list is not modified.
// Expected context properties: rconn, iconn, channel
// @param files {array-like} an array-like collection of file objects, such as
// a FileList, or an array
export async function import_opml(files, options) {
  log('%s: importing %d file(s)', import_opml.name, files.length);

  const subscribe_promises = [];
  const import_file_promises = [];
  const import_file_bound = import_file.bind(this, subscribe_promises);
  for (const file of files) {
    const import_file_promise = import_file_bound(file, options);
    import_file_promises.push(import_file_promise);
  }

  // Wait for all import promises to settle. This ensures that we properly
  // spawned all subscribe promises before returning. Note that at this point
  // the subscribe promises may be outstanding. Completing a single file
  // import just means we basically read in the file and spawned promises, not
  // also that those promises settled. If we did not block here, then it would
  // be possible that we return an incomplete list of promises to await.
  await Promise.all(import_file_promises);

  // Now actually wait for all subscribe promises to settle.
  // TODO: what about Promise.all short-circuiting here in the case of a
  // subscribe promise rejection? What is the desired behavior? Should
  // everything fail, or should failures be skipped?
  // TODO: we don't actually need to await, right? Because if we return
  // a promise from an async function, that becomes the async function's
  // return value (I think). Review async.
  return await Promise.all(subscribe_promises);
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
async function import_file(subscribe_promises, file, options) {
  log('%s: name %s size %d type %s', import_file.name, file.name, file.size,
      file.type);

  if (!file.size || !opml_mime_types.includes(file.type)) {
    return;
  }

  // TODO: I hate this try/catch block. i/o errors are not programmer errors,
  // just plain old errors that are typical when performing i/o. Need to
  // rethink.
  let file_text;
  try {
    file_text = await file_read_text(file);
  } catch (error) {
    log(error);
    return;
  }

  // TODO: I hate this try/catch block. parsing errors are not exceptions, just
  // bad data. Need to rethink the parse_opml signature.
  let document;
  try {
    document = parse_opml(file_text);
  } catch (error) {
    log(error);
    return;
  }

  // Find all unique feed urls in the opml document. Even if none are found,
  // urls is a defined array.
  const urls = dedup_urls(find_feed_urls(document));

  // Setup a generic subscribe operation context that we will reuse for each
  // subscribe operation. This is safe for reuse because subscribe warrants
  // treatment of context as immutable.
  const op = {};
  op.rconn = this.rconn;
  op.iconn = this.iconn;
  op.channel = this.channel;
  op.subscribe = subscribe;

  const sub_options = {};
  sub_options.fetch_timeout = options.fetch_timeout;
  sub_options.skip_icon_lookup = options.skip_icon_lookup;
  sub_options.notify = false;  // Never notify

  // For each feed url, subscribe. Store a reference to the subscribe promise
  // in the promises array.
  for (const url of urls) {
    // subscribe returns a promise, and we want the promise here, since we are
    // doing concurrent subscription operations, so we do not await
    const subscribe_promise = op.subscribe(url, sub_options);
    subscribe_promises.push(subscribe_promise);
  }
}

// Never returns undefined
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

// Searches the nodes of the document for feed urls. Returns an array of
// feed url objects (not strings!). Never returns undefined.
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

function file_read_text(file) {
  return new Promise(function executor(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = _ => resolve(reader.result);
    reader.onerror = _ => reject(reader.error);
  });
}
