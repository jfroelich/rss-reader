import * as string from '/src/lib/string.js';
import Model from '/src/model/model.js';

// Concurrently reads in the opml files and creates feeds in the database. Note
// that this bypasses the subscription process which means there are multiple
// methods of input, but technically they all still share usage of the
// ModelAccess.createFeed call. Also note that this does not fetch the full feed
// data, and instead leaves that concern to the eventual poll that later runs.
// Also note that this ignores all other data from the opml files other than
// feed urls, because it is assumed it is better to get the most current data
// from the network in a subsequent poll, even if that risks potential data
// loss. Avoiding the network in this operation helps keep this operation
// reasonably fast.
//
// File io errors are logged as a side effect, because this does not fail if any
// individual file fails to be processed.
//
// For each inserted feed, a message is broadcast with type feed-created and the
// id of the new feed.
//
// @param ma {ModelAccess} an open instance of ModelAccess
// @param files {for..of iterable} any iterable collection such as an Array or
// FileList, the contents of which should be either Blobs or Files
// @throws {DOMException} database error, if any database error occurs then no
// feeds are stored (internally the operation uses a single transaction)
// @return {Promise} resolves to an array of ModelAccess.createFeed promise
// results. The array contains undefined when an individual createFeed promise
// rejected. Array order is undefined (this makes no contractual guarantees).
export async function import_opml(ma, files) {
  const read_results = await read_files(files);
  const urls = flatten_file_urls(read_results);
  const unique_urls = dedup_urls(urls);

  // Map the urls into plain model feed objects
  const feeds = unique_urls.map(url => {
    const feed = Model.createFeed();
    Model.append_feed_url(feed, url);
    return feed;
  });

  // Return the raw promise produced by createFeeds. There is no need to await
  // because we are within an async function that will just wrap the resolved
  // value within another promise. It is in fact better to just return the
  // promise.
  return ma.createFeeds(feeds);
}

// Read in all the feed urls from all of the files into an array of arrays.
// Files are read and processed concurrently.
function read_files(files) {
  const promises = [];
  for (const file of files) {
    const promise = read_file_feeds(file);
    // If any one file fails to be read just log an error message and continue
    // instead of having the whole thing fail.
    const catch_promise = promise.catch(console.warn);
    promises.push(catch_promise);
  }
  return Promise.all(promises);
}

// Flatten the results into a single array and filter missing values
function flatten_file_urls(all_files_urls) {
  const urls = [];
  for (const per_file_urls of all_files_urls) {
    // per_file_urls may be undefined if there was a problem reading the file
    // that generated it
    if (per_file_urls) {
      for (const url of per_file_urls) {
        if (url) {
          urls.push(url);
        }
      }
    }
  }
  return urls;
}

// Returns a promise that resolves to an array of feed urls in the opml file.
// Throws errors if bad parameter, bad file type, i/o, parsing. Does not filter
// dupes. The return value is always a defined array, but may be empty.
async function read_file_feeds(file) {
  if (!file_is_opml(file)) {
    throw new TypeError(
        'Unacceptable type ' + file.type + ' for file ' + file.name);
  }

  if (!file.size) {
    return [];
  }

  const file_text = await file_read_text(file);
  const document = parse_opml(file_text);
  return find_feed_urls(document);
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
// objects. The array is always defined even when no urls found.
function find_feed_urls(document) {
  const elements = document.querySelectorAll('opml > body > outline[type]');
  const type_pattern = /^\s*(rss|rdf|feed)\s*$/i;
  const urls = [];
  for (const element of elements) {
    const type = element.getAttribute('type');
    if (type_pattern.test(type)) {
      const url = parse_url_noexcept(element.getAttribute('xmlUrl'));
      if (url) {
        urls.push(url);
      }
    }
  }
  return urls;
}

function parse_url_noexcept(url_string) {
  if (url_string) {
    try {
      return new URL(url_string);
    } catch (error) {
    }
  }
}

function file_is_opml(file) {
  const opml_mime_types = [
    'application/xml', 'application/xhtml+xml', 'text/xml', 'text/x-opml',
    'application/opml+xml'
  ];
  return opml_mime_types.includes(file.type);
}

function file_read_text(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = _ => resolve(reader.result);
    reader.onerror = _ => reject(reader.error);
  });
}

// Parses a string containing opml into a xml-flagged document object. Throws an
// error if the parameter is unexpected or if there is a parse error.
function parse_opml(xml_string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml_string, 'application/xml');
  const error = document.querySelector('parsererror');
  if (error) {
    throw new Error(string.condense_whitespace(error.textContent));
  }

  // Need to normalize localName when document is xml-flagged
  const name = document.documentElement.localName.toLowerCase();
  if (name !== 'opml') {
    throw new Error('Document element is not opml: ' + name);
  }
  return document;
}
