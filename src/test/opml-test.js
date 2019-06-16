import * as DBService from '/src/service/db-service.js';
import * as databaseUtils from '/src/test/database-utils.js';
import * as db from '/src/db/db.js';
import * as indexedDBUtils from '/src/lib/indexeddb-utils.js';
import * as opml from '/src/lib/opml.js';
import TestRegistry from '/src/test/test-registry.js';
import assert from '/src/lib/assert.js';

// Exercise the typical usage of export-opml
async function exportOPMLTest() {
  const databaseNamePrefix = 'export-opml-test';
  await databaseUtils.removeDatabasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);
  const conn = await databaseUtils.createTestDatabase(databaseName);

  // Insert some test feeds
  const resources = [];
  for (let i = 0; i < 3; i += 1) {
    const resource = {};
    db.setURL(resource, new URL(`a://b.c${i}`));
    resource.type = 'feed';
    resource.feed_format = 'DBService';
    resource.title = `feed-title-${i}`;
    resource.description = `feed-description-${i}`;
    resource.link = `https://www.example.com/${i}`;
    resources.push(resource);
  }

  const promises = [];
  for (const resource of resources) {
    promises.push(DBService.createFeed(conn, resource));
  }
  await Promise.all(promises);

  // Practice similar steps to what the UI would do. Load the resources back from the database and
  // convert them into outlines
  const readResources = await DBService.getFeeds(conn, { mode: 'feeds' });
  const outlines = readResources.map((resource) => {
    const outline = {};
    outline.type = resource.feed_format;

    // Although the model dictates all feeds have a url, make no assumption here. Grab the last url
    // of the array as the representation of the resource's current url.
    if (resource.urls && resource.urls.length) {
      outline.xmlUrl = resource.urls[resource.urls.length - 1];
    }

    outline.title = resource.title;
    outline.description = resource.description;
    outline.htmlUrl = resource.link;
    return outline;
  });

  // It is implied but this should not throw an exception
  const document = await opml.createDocument('test-title');
  opml.appendOutlines(document, outlines);

  // export-opml should generate a Document object
  assert(document instanceof Document);

  // The title should be set if specified
  const titleElement = document.querySelector('title');
  assert(titleElement);
  assert(titleElement.textContent === 'test-title');

  // The correct number of outlines should have been generated
  const outlineElements = document.querySelectorAll('outline');
  assert(outlineElements.length === resources.length);

  // For each feed that has a url, it should have a corresponding outline based on the outline's
  // xmlurl attribute value.
  for (const feed of resources) {
    const url = new URL(feed.urls[feed.urls.length - 1]);
    const selector = `outline[xmlUrl="${url.href}"]`;
    const outline = document.querySelector(selector);
    assert(outline instanceof Element);
  }

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}

TestRegistry.registerTest(exportOPMLTest);
