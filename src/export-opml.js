import {db_get_feeds} from '/src/db/db-get-feeds.js';
import {list_peek} from '/src/lib/lang/list.js';

// Generates an opml document object consisting of all of the feeds in the
// database.
// @context-param {conn} an open database connection
// @context-param {console} logging destination
// @param title {String} the desired value of the opml title element
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

// TODO: this is responsible for generating valid opml. Therefore, it actually
// should be concerned with validating the input feeds, and not assume the input
// data is valid. Currently this makes the implicit assumption that the input
// is well-formed.

// TODO: revisit the concept of function-as-object. This might be better than
// the implicit context approach. That is pretty much what objects are after
// all, explicit context via object properties. It just feels so wrong to have
// an object named ExportOPMLOperation when it nothing more than a function and
// there is no state to manage. The reality is that the problem is that there
// are too many parameters. The goal is to use fewer parameters, so that the
// calling syntax is easier to read. The approach I use now is creative, and
// kind of cool, but it is on the idiosyncratic side. I think I should use the
// more conventional approach. Holding off on this, because this would be a
// sweeping change to several modules that use the same pattern.

export async function export_opml(title) {
  this.console.log('Creating opml from database', this.conn.name);

  const feeds = await db_get_feeds(this.conn);
  this.console.debug('Loaded %d feeds', feeds.length);

  const document = create_opml_document(title);
  for (const feed of feeds) {
    const feed_url = list_peek(feed.urls);
    this.console.debug('Appending feed', feed_url);
    append_feed(document, feed);
  }

  return document;
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

// Append the feed to the opml document as an outline element. Missing
// properties are skipped.
// TODO: reintroduce validation that the feed has a url. It is incorrect to
// write a feed without a url to the document. This is an invariant
// precondition, and it is this function's concern.
// TODO: revisit whether it made more sense to have a mapping function that just
// returns a new outline element. Then this feed does not need the body-append
// section, and it becomes oblivious to body structure, or how the output
// element will be used. This would also solve the problem about the repeated
// body lookup that I discuss in a comment below.
// TODO: I dislike how much knowledge this has of feed structure. I want to
// introduce a layer of indirection that does something like coerce feed data
// loaded from the database into a more generic feed-info data object, and have
// this operate on that generic object, with no coupled knowledge of the db
// feed format.
function append_feed(document, feed) {
  // Create the outline from the parameter document, not the document running
  // this script. This is important with regard to XSS. Theoretically, bad data
  // could get written into the database, then read from the database, then get
  // input here.
  const outline = document.createElement('outline');

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

  // TODO: this lookup per call feels wasteful considering the presence of the
  // body element is expected to be invariant. I think this could be easily
  // solved by making body a parameter. Despite the obvious functional
  // dependency of body on the document parameter. I think it is acceptable to
  // break that rule when there is a substantial performance benefit or
  // something that just feels more correct.

  // In case it is unclear, implicitly-xml-flagged documents do not support the
  // document.body shortcut, so use querySelector. At least in Chrome.
  const body_element = document.querySelector('body');
  body_element.appendChild(outline);
}
