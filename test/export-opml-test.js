import assert from '/lib/assert.js';
import {export_opml, Outline} from '/lib/export-opml.js';
import * as indexeddb_utils from '/lib/indexeddb-utils.js';
import * as db from '/src/db/db.js';
import * as database_utils from '/test/database-utils.js';


// Exercise the typical usage of export-opml
export default async function export_opml_test() {
  const db_name = 'export-opml-test';
  await indexeddb_utils.remove(db_name);

  const conn = await database_utils.create_test_database(db_name);

  // Insert some test feeds
  let resources = [];
  for (let i = 0; i < 3; i++) {
    const resource = {};
    db.set_url(resource, new URL('a://b.c' + i));
    resource.type = 'feed';
    resource.feed_format = 'rss';
    resource.title = 'feed-title-' + i;
    resource.description = 'feed-description-' + i;
    resource.link = 'https://www.example.com/' + i;
    resources.push(resource);
  }

  const promises = [];
  for (const resource of resources) {
    promises.push(db.create_resource(conn, resource));
  }
  await Promise.all(promises);

  // Practice similar steps to what the UI would do. Load the resources back
  // from the database and convert them into outlines
  const read_resources = await db.get_resources({conn: conn, mode: 'feeds'});
  const outlines = read_resources.map(resource => {
    const outline = new Outline();
    outline.type = resource.feed_format;

    if (db.has_url(resource)) {
      outline.xml_url = db.get_url_string(resource);
    }

    outline.title = resource.title;
    outline.description = resource.description;
    outline.html_url = resource.link;
    return outline;
  });

  // It is implied but this should not throw an exception
  const document = await export_opml(outlines, 'test-title');

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
    const url = db.get_url(feed);
    const selector = 'outline[xmlUrl="' + url.href + '"]';
    const outline = document.querySelector(selector);
    assert(outline instanceof Element);
  }

  conn.close();
  await indexeddb_utils.remove(conn.conn.name);
}
