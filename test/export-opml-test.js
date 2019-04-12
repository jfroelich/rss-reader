import assert from '/lib/assert.js';
import { exportOPML, Outline } from '/lib/export-opml.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import * as db from '/src/db/db.js';
import * as databaseUtils from '/test/database-utils.js';

// Exercise the typical usage of export-opml
export default async function export_opml_test() {
  const database_name_prefix = 'export-opml-test';
  await databaseUtils.remove_databases_for_prefix(database_name_prefix);
  const database_name = databaseUtils.create_unique_database_name(database_name_prefix);

  const conn = await databaseUtils.create_test_database(database_name);

  // Insert some test feeds
  const resources = [];
  for (let i = 0; i < 3; i++) {
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
  const read_resources = await db.getResources({ conn, mode: 'feeds' });
  const outlines = read_resources.map((resource) => {
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
  const title_element = document.querySelector('title');
  assert(title_element);
  assert(title_element.textContent === 'test-title');

  // The correct number of outlines should have been generated
  const outline_elements = document.querySelectorAll('outline');
  assert(outline_elements.length === resources.length);

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
