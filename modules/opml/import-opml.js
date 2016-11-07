// See license.md

'use strict';

// TODO: this should accept conn instead of db_target and require caller
// to open/close conn, it is more decoupled and easier to mock deps
// NOTE: db_target is no longer used
// TODO: cleanup some of the helper fns
// TODO: return successful subscriptions count
async function import_opml(db_target, files, log = SilentConsole) {

  log.log('Starting opml import');
  files = Array.prototype.filter.call(files,
    (file) => file.type.toLowerCase().includes('xml'));
  files = Array.prototype.filter.call(files, (file) => file.size > 0);

  if(!files.length)
    return;

  const suppress_subscribe_notif = true;
  const feed_store = await ReaderStorage.connect(log);
  const icon_conn = await favicon.connect(undefined, undefined, log);

  // TODO: wrap subscribe in a local async function that traps the error,
  // then use promise.all here

  for(let file of files) {
    const text = await read_file_as_text(file);
    const doc = parse_opml(text);
    const outline_elements = select_outline_elements(doc);
    let outlines = outline_elements.map(create_outline_obj);
    outlines = outlines.filter(outline_has_valid_type);
    outlines = outlines.filter(outline_has_url);
    outlines.forEach(deserialize_outline_url);
    outlines = outlines.filter(outline_has_url_obj);
    outlines = filter_dup_outlines(outlines);
    const feeds = outlines.map(outline_to_feed);
    for(let feed of feeds) {
      // Allow for individual subscriptions to fail
      try {
        await subscribe(feed_store, icon_conn, feed,
          suppress_subscribe_notif, log);
      } catch(error) {
        log.debug(error);
      }
    }
  }

  feed_store.disconnect();
  icon_conn.close();
  log.debug('Import completed');
}

function parse_opml(str) {
  const doc = parse_xml(str);
  if(!doc)
    throw new Error('parse_xml did not yield a document');
  const root_name = doc.documentElement.localName;
  if(root_name !== 'opml')
    throw new Error('Invalid document element: ' + root_name);
  return doc;
}

// TODO: is there a promisified Reader?
function read_file_as_text(file) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function(event) {
      resolve(event.target.result);
    };
    reader.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

function select_outline_elements(doc) {
  const outlines = [];
  // doc.body is undefined, not sure why
  const body = doc.querySelector('body');
  if(!body)
    return outlines;
  for(let el = body.firstElementChild; el; el = el.nextElementSibling) {
    if(el.localName === 'outline')
      outlines.push(el);
  }
  return outlines;
}

function create_outline_obj(element) {
  return {
    'description': element.getAttribute('description'),
    'link': element.getAttribute('htmlUrl'),
    'text': element.getAttribute('text'),
    'title': element.getAttribute('title'),
    'type': element.getAttribute('type'),
    'url': element.getAttribute('xmlUrl')
  };
}

function outline_has_valid_type(outline) {
  return outline.type && outline.type.length > 2 &&
    /rss|rdf|feed/i.test(outline.type);
}

function outline_has_url(outline) {
  return outline.url && outline.url.trim();
}

function deserialize_outline_url(outline) {
  try {
    outline.url_obj = new URL(outline.url);
    outline.url_obj.hash = '';
  } catch(error) {
  }
}

function outline_has_url_obj(outline) {
  return 'url_obj' in outline;
}

function filter_dup_outlines(outlines) {
  const output = [];
  const seen_urls = [];
  for(let outline of outlines) {
    if(!seen_urls.includes(outline.url_obj.href)) {
      seen_urls.push(outline.url_obj.href);
      output.push(outline);
    }
  }
  return output;
}

function outline_to_feed(outline) {
  const feed = {};
  add_feed_url(feed, outline.url_obj.href);
  feed.type = outline.type;
  feed.title = outline.title || outline.text;
  feed.description = outline.description;
  if(outline.link) {
    try {
      const linkURL = new URL(outline.link);
      linkURL.hash = '';
      feed.link = linkURL.href;
    } catch(error) {
    }
  }
  return feed;
}
