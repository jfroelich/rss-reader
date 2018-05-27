import {db_open} from '/src/db/db-open.js';
import {import_opml} from '/src/import-opml.js';
import {idb_remove} from '/src/lib/idb.js';
import {parse_opml} from '/src/lib/parse-opml.js';
import {assert} from '/src/tests/assert.js';

// TODO: finish implementation. at the moment this basically just tests if this
// can even run, and the subscribe always fails so cannot test results

// TODO: for testing purposes I'd like to be able to subscribe without fetch
// so I think subscribe needs to be changed to allow that, and I need to be able
// to pass through an option from import-opml to subscribe
// otherwise i need to use real urls so subscribe doesn't fail and actually
// affects the db. but it is bad practice to use real urls.
// Perhaps instead the subscribe API should be accepting Response objects as
// input instead of URLs. That way I cut out the fetch issue, and can mock
// response. But I only partially cut it out because of the icon issue?
// I guess it is kind of annoying to not abstract away the fetch though. It
// leads to having too many pieces to compose.

// TODO: add option to import-opml to pass along to subscribe to skip
// icon lookup, then skip it here in the test

// TODO: test multiple files
// TODO: test multiple feeds per file
// TODO: test dup handling

// todo: use try/finally and ensure db cleaned up, maybe use a helper

export async function import_opml_test() {
  // mock file, blobs 'implement' the File interface
  const opml_string = '<opml version="2.0"> <body><outline type="feed" ' +
      'xmlUrl="http://www.example.com/example.rss"/></body></opml>';
  const file0 = new Blob([opml_string], {type: 'application/xml'});
  file0.name = 'file0.xml';

  const files = [file0];

  const db_name = 'import-opml-test-db';
  let db_version;
  const db_timeout = 3000;

  const op = {};
  op.rconn = await db_open(db_name, db_version, db_timeout);
  op.iconn = undefined;  // test without favicon caching support
  op.channel = new BroadcastChannel('import-opml-test');
  op.console = console;
  op.import_opml = import_opml;

  const options = {};

  // It's possible this should be relaxed, undecided. In some sense it impacts
  // the overall test, and it may be even longer than the test timeout
  options.fetch_timeout = 5000;

  // We are not testing this, and this is resource-intensive and not value
  // adding.
  options.skip_icon_lookup = true;

  const results = await op.import_opml(files);

  // TODO: make assertions about the result
  // is the new database state correct
  // is the results value correct
  console.log(results);

  op.rconn.close();
  op.channel.close();

  await idb_remove(op.rconn.name);
}
