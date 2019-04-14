import * as databaseUtils from '/test/database-utils.js';
import * as db from '/src/db/db.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import { Outline, exportOPML } from '/lib/export-opml.js';
import assert from '/lib/assert.js';

// Exercise the typical usage of export-opml
export default async function exportOPMLTest() {
  const databaseNamePrefix = 'export-opml-test';
  await databaseUtils.removeDatbasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);
  const conn = await databaseUtils.createTestDatabase(databaseName);

  // Insert some test feeds
  const resources = [];
  for (let i = 0; i < 3; i += 1) {
    const resource = {};
    db.setURL(resource, new URL(`a://b.c${i}`));
    resource.type = 'feed';
    resource.feed_format = 'rss';
    resource.title = `feed-title-${i}`;
    resource.description = `feed-description-${i}`;
    resource.link = `https://www.example.com/${i}`;
    resources.push(resource);
  }

  const promises = [];
  for (const resource of resources) {
    promises.push(db.createResource(conn, resource));
  }
  await Promise.all(promises);

  // Practice similar steps to what the UI would do. Load the resources back
  // from the database and convert them into outlines
  const readResources = await db.getResources({ conn, mode: 'feeds' });
  const outlines = readResources.map((resource) => {
    const outline = new Outline();
    outline.type = resource.feed_format;

    if (db.hasURL(resource)) {
      outline.xmlUrl = db.getURLString(resource);
    }

    outline.title = resource.title;
    outline.description = resource.description;
    outline.htmlUrl = resource.link;
    return outline;
  });

  // It is implied but this should not throw an exception
  const document = await exportOPML(outlines, 'test-title');

  // export-opml should generate a Document object
  assert(document instanceof Document);

  // The title should be set if specified
  const titleElement = document.querySelector('title');
  assert(titleElement);
  assert(titleElement.textContent === 'test-title');

  // The correct number of outlines should have been generated
  const outlineElements = document.querySelectorAll('outline');
  assert(outlineElements.length === resources.length);

  // For each feed that has a url, it should have a corresponding outline based
  // on the outline's xmlurl attribute value.
  for (const feed of resources) {
    const url = db.getURL(feed);
    const selector = `outline[xmlUrl="${url.href}"]`;
    const outline = document.querySelector(selector);
    assert(outline instanceof Element);
  }

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
