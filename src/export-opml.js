import {db_get_feeds} from '/src/db/db-get-feeds.js';
import {list_is_empty, list_peek} from '/src/lib/lang/list.js';
import {log} from '/src/log.js';

// Generates an opml document object consisting of all of the feeds in the
// database.
// @context-param {conn} an open database connection
// @param title {String} optional, the desired value of the opml title element,
// caller is responsible for ensuring it is either falsy or a valid string
// @throws {Error} when any context property is undefined or wrong type
// @throws {DOMException} when a database error occurs
// @returns {Document} returns a promise that resolves to the generated xml
// document

// TODO: test. In order to make this testable, the database needs to be
// mockable, so this code has a design flaw. A simple solution would be to
// accept a feeds array as input, and basically shift the burden of database
// interaction to the caller. So that leads to a larger problem, which is that
// this creates boilerplate, and it is unclear who should be responsible for
// loading. Rather, Do I want loading feeds to be abstracted away? Maybe the one
// extra line is insignificant. Food for thought. It might also make more sense
// to have this basically be completely decoupled from the database.
//
// Continuning that thought, if i make feeds a parameter, then this is
// effectively no longer doing a real export. In fact this is basically just a
// create-opml-document function in which case I should consider renaming the
// file and the public function, and also rename the private helper that
// currently occupies that name. Furthermore, consider that because I already
// removed the download-file trigger in some commit several months ago, this
// really has lost much of its original meaning. The export-opml verb concept
// now belongs to the button click handler that is located in a higher layer
// closer to the view. And even further more, if I make feeds param, then I no
// longer need this.conn, and this would obviate the need to use the
// function-as-object approach because the parameter complexity drops
// substantially.

// TODO: I dislike how much knowledge create_outline_element has of feed
// structure. I want to introduce a layer of indirection that does something
// like coerce feed data loaded from the database into a more generic feed-info
// data object, and have this operate on that generic object, with no coupled
// knowledge of the db feed format.

// TODO: revisit the concept of function-as-object. This might be better than
// the implicit context approach. That is pretty much what objects are after
// all, explicit context via object properties. It just feels so wrong to have
// an object named ExportOPMLOperation when it nothing more than a function and
// there is no state to manage. The reality is that the problem is that there
// are too many parameters. The goal is to use fewer parameters, so that the
// calling syntax is easier to read. The approach I use now is creative, and
// kind of cool, but it is on the idiosyncratic side. I think I should use the
// more conventional approach. Holding off on this, because this would be a
// sweeping change to several modules that use the same pattern. Also holding
// off because of the recently added notes about decoupling the feed lookup.

export async function export_opml(conn, title) {
  log('Creating opml document from database', conn.name);

  const feeds = await db_get_feeds(conn);
  log('Loaded %d feeds', feeds.length);

  const document = create_opml_document(title);
  const body_element = get_xml_document_body(document);

  for (const feed of feeds) {
    if (list_is_empty(feed.urls)) {
      log('Skipping feed that is missing url', feed);
    } else {
      log('Appending feed', list_peek(feed.urls));
      body_element.appendChild(create_outline_element(document, feed));
    }
  }

  return document;
}

// The behavior of the builtin Document type unexpectedly changes based on a
// secret flag denoting whether the document is xml or html. In particular,
// the document.body getter shortcut yields undefined for xml.
function get_xml_document_body(document) {
  return document.querySelector('body');
}

function create_opml_document(title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const head_element = doc.createElement('head');
  doc.documentElement.appendChild(head_element);

  if (title) {
    const title_element = doc.createElement('title');
    title_element.textContent = title;
  }

  const current_date = new Date();
  const current_date_utc_string = current_date.toUTCString();

  const date_created_element = doc.createElement('datecreated');
  date_created_element.textContent = current_date_utc_string;
  head_element.appendChild(date_created_element);

  const date_modified_element = doc.createElement('datemodified');
  date_modified_element.textContent = current_date_utc_string;
  head_element.appendChild(date_modified_element);

  const docs_element = doc.createElement('docs');
  docs_element.textContent = 'http://dev.opml.org/spec2.html';
  head_element.appendChild(docs_element);

  const body_element = doc.createElement('body');
  doc.documentElement.appendChild(body_element);
  return doc;
}

// Uses host_document, not window.document, to avoid XSS issues
function securely_create_outline(host_document) {
  return host_document.createElement('outline');
}

function create_outline_element(document, feed) {
  const outline = securely_create_outline(document);

  // TODO: if feed is missing xmlUrl, maybe just exit early with a useless
  // outline object. Or just create the outline as normal but missing the
  // xmlUrl attribute. Basically, remove the expectation it is defined here,
  // so that this tolerates malformed data better. Doing so shifts the problem
  // to the app user who will see a useless outline element in their xml file,
  // but at least an actual programming exception is no longer thrown here.
  // Outlines "should" have an xmlUrl, so it is in some sense required, but
  // that is someone else's problem.

  if (feed.type) {
    outline.setAttribute('type', feed.type);
  }

  outline.setAttribute('xmlUrl', list_peek(feed.urls));

  if (feed.title) {
    outline.setAttribute('title', feed.title);
  }

  if (feed.description) {
    outline.setAttribute('description', feed.description);
  }

  if (feed.link) {
    outline.setAttribute('htmlUrl', feed.link);
  }

  return outline;
}
