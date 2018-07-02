import * as string from '/src/lib/string.js';
import * as Model from '/src/model/model.js';

// Reads in the files, parses them, finds feed urls, and then creates a feed for
// each url in the reader database. Other feed data from opml attributes is
// ignored. Completes when all of the files have been read and each feed has
// been created. Dispatches a feed-created message for each inserted feed.
//
// File io errors are logged as a side effect and not thrown, and do not
// interrupt execution.
//
// @param ma {ModelAccess} an open instance of ModelAccess
// @param files {for..of iterable} any iterable collection such as an Array or
// FileList, the contents of which should be either Blobs or Files
// @throws {DOMException} database errors
// @throws {InvalidStateError} if channel from model access is somehow closed
// at time of posting messages
// @throws {Error} invalid parameters
// @return {Promise} resolves to an array of new feed ids
export async function import_opml(ma, files) {
  const read_files_results = await read_files(files);
  const url_array = flatten_file_urls(read_files_results);
  const url_array_set = dedup_urls(url_array);

  const feeds = url_array_set.map(url => {
    const feed = Model.create_feed();
    Model.append_feed_url(feed, url);
    return feed;
  });

  // Because we are only considering urls, there is no need to do any validation
  // or sanitization of the feed objects prior to insertion
  return ma.createFeeds(feeds);
}

// Read in all the feed urls from all of the files into an array of arrays.
// Files are read and processed concurrently. Any one file read error does not
// cancel the operation, instead an undefined value is stored in the output
// array the returned promise resolved to.
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
        urls.push(url);
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
// Using a plain array is sufficient and faster than using a Set.
function dedup_urls(urls) {
  const url_set = [], seen = [];
  for (const url of urls) {
    if (!seen.includes(url.href)) {
      url_set.push(url);
      seen.push(url.href);
    }
  }
  return url_set;
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
