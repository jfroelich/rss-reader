import { parseOPML } from '/lib/parse-opml.js';
import * as db from '/src/db/db.js';

// Create and store feed objects in the database based on urls extracted from
// zero or more opml files. |files| should be a FileList or an Array.
export default async function importOPML(conn, files) {
  console.log('Importing %d OPML files', files.length);

  // Grab urls from each of the files. Per-file errors, including assertion
  // errors, are logged not thrown.
  const promises = Array.prototype.map.call(files, file => file_find_urls(file).catch(console.warn));
  const results = await Promise.all(promises);

  // Flatten results into a simple array of urls
  const urls = [];
  for (const result of results) {
    if (result) {
      for (const url of result) {
        urls.push(url);
      }
    }
  }

  // Filter dups
  const urlSet = [];
  const seenHrefs = [];
  for (const url of urls) {
    if (!seenHrefs.includes(url.href)) {
      urlSet.push(url);
      seenHrefs.push(url.href);
    }
  }

  const feeds = urlSet.map((url) => {
    const feed = {};
    feed.active = 1;
    feed.type = 'feed';
    db.setURL(feed, url);
    return feed;
  });

  const createPromises = [];
  for (const feed of feeds) {
    console.debug('Creating resource', feed);
    createPromises.push(db.createResource(conn, feed));
  }

  return Promise.all(createPromises);
}

// Return an array of outline urls (as URL objects) from OPML outline elements
// found in the plaintext representation of the given file
async function file_find_urls(file) {
  return find_outline_urls(parseOPML(await file_read_text(file)));
}

// Return an array of outline urls (as URL objects) from outlines found in an
// OPML document
function find_outline_urls(doc) {
  // Assume the document is semi-well-formed. As a compromise between a deep
  // strict validation and no validation at all, use the CSS restricted-parent
  // selector syntax. We also do some filtering of outlines here up front to
  // only those with a type attribute because it is slightly better performance
  // and less code.
  const outlines = doc.querySelectorAll('opml > body > outline[type]');

  // Although I've never seen it in the wild, apparently OPML outline elements
  // can represent non-feed data. Use this pattern to restrict the outlines
  // considered to those properly configured.
  const type_pattern = /^\s*(rss|rdf|feed)\s*$/i;

  const urls = [];
  for (const outline of outlines) {
    const type = outline.getAttribute('type');
    if (type_pattern.test(type)) {
      const xml_url_value = outline.getAttribute('xmlUrl');
      try {
        urls.push(new URL(xml_url_value));
      } catch (error) {
        // Ignore the error, skip the url
      }
    }
  }

  return urls;
}

function file_read_text(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = _ => resolve(reader.result);
    reader.onerror = _ => reject(reader.error);
  });
}
