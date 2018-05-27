import {config_inaccessible_content_descriptors} from '/src/config.js';
import {db_find_entry_id_by_url} from '/src/db/db-find-entry-id-by-url.js';
import {db_sanitize_entry} from '/src/db/db-sanitize-entry.js';
import {db_validate_entry} from '/src/db/db-validate-entry.js';
import {db_write_entry} from '/src/db/db-write-entry.js';
import {append_entry_url, is_valid_entry_id} from '/src/entry.js';
import {favicon_lookup} from '/src/favicon.js';
import {fetch_html} from '/src/fetch.js';
import {set_document_base_uri} from '/src/lib/dom/set-document-base-uri.js';
import {parse_html} from '/src/lib/html/parse-html.js';
import {list_is_empty, list_peek} from '/src/lib/lang/list.js';
import * as sniff from '/src/lib/net/sniff.js';
import {url_did_change} from '/src/lib/net/url-did-change.js';
import {rewrite_url} from '/src/lib/rewrite-url.js';
import {transform_document} from '/src/transform-document.js';

const rewrite_rules = build_rewrite_rules();

export async function poll_entry(entry) {
  if (list_is_empty(entry.urls)) {
    return;
  }

  entry_rewrite_tail_url(entry, rewrite_rules);
  if (await entry_exists(this.rconn, entry)) {
    return;
  }

  const response = await fetch_entry(entry, this.fetch_html_timeout);
  if (await handle_entry_redirect(this.rconn, entry, response, rewrite_rules)) {
    return;
  }

  const document = await parse_response(response);
  update_entry_title(entry, document);
  await update_entry_icon(this.iconn, this.console, entry, document);
  await update_entry_content(
      entry, document, this.console, this.fetch_image_timeout);

  // Explicitly validate the entry. This was previously done via the call to
  // db_write_entry, and threw a type error which was not caught here. For now,
  // just throw a basic error to match the previous behavior. In the future,
  // think about whether this should be throwing an error at all or doing
  // something else.
  if (!db_validate_entry(entry)) {
    throw new Error('Invalid entry ' + entry);
  }

  // Explicitly sanitize the entry. This was previously done by db_write_entry
  // but that is no longer the case. For now, replace the parameter value with
  // itself, even though sanitize clones. Also note that sanitize now filters
  // empty properties implicitly
  entry = db_sanitize_entry(entry);

  const op = {};
  op.conn = this.rconn;
  op.channel = this.channel;
  op.console = this.console;
  op.db_write_entry = db_write_entry;
  const new_entry_id = await op.db_write_entry(entry);
  return new_entry_id;
}

async function handle_entry_redirect(rconn, entry, response, rewrite_rules) {
  if (!response) {
    return false;
  }

  const request_url = new URL(list_peek(entry.urls));
  const response_url = new URL(response.url);
  if (!url_did_change(request_url, response_url)) {
    return false;
  }

  append_entry_url(entry, response_url);
  entry_rewrite_tail_url(entry, rewrite_rules);
  return await entry_exists(rconn, entry);
}

function entry_rewrite_tail_url(entry, rewrite_rules) {
  const tail_url = new URL(list_peek(entry.urls));
  const new_url = rewrite_url(tail_url, rewrite_rules);
  if (!new_url) {
    return false;
  }
  return append_entry_url(entry, new_url);
}

async function entry_exists(rconn, entry) {
  const url = new URL(list_peek(entry.urls));
  const op = {conn: rconn, db_find_entry_id_by_url: db_find_entry_id_by_url};
  const id = await op.db_find_entry_id_by_url(url);
  return is_valid_entry_id(id);
}

// TODO: i think this should always return a response, so instead of returning
// undefined if not augmentable, return a stub error promise
// TODO: undecided, but maybe augmentability is not this function's concern?
async function fetch_entry(entry, fetch_html_timeout) {
  const url = new URL(list_peek(entry.urls));
  if (url_is_augmentable(url)) {
    const response = await fetch_html(url, fetch_html_timeout);
    if (response.ok) {
      return response;
    }
  }
}

function url_is_augmentable(url) {
  return url_is_http(url) && sniff.classify(url) !== sniff.BINARY_CLASS &&
      !url_is_inaccessible_content(url);
}

function url_is_inaccessible_content(url) {
  for (const desc of config_inaccessible_content_descriptors) {
    if (desc.pattern && desc.pattern.test(url.hostname)) {
      return true;
    }
  }
  return false;
}

function url_is_http(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

async function parse_response(response) {
  if (!response) {
    return;
  }

  const response_text = await response.text();

  try {
    return parse_html(response_text);
  } catch (error) {
  }
}

function update_entry_title(entry, document) {
  if (document && !entry.title) {
    const title_element = document.querySelector('html > head > title');
    if (title_element) {
      entry.title = title_element.textContent;
    }
  }
}

async function update_entry_icon(iconn, console, entry, document) {
  const lookup_url = new URL(list_peek(entry.urls));

  const op = {};
  op.conn = iconn;
  op.console = console;
  op.favicon_lookup = favicon_lookup;

  const fetch = false;
  const icon_url_string = await op.favicon_lookup(lookup_url, document, fetch);
  if (icon_url_string) {
    entry.faviconURLString = icon_url_string;
  }
}

async function update_entry_content(
    entry, document, console, fetch_image_timeout) {
  if (!document) {
    try {
      document = parse_html(entry.content);
    } catch (error) {
      entry.content = 'Bad formatting (unsafe HTML redacted)';
      return;
    }
  }

  // transform_document requires the document have document.baseURI set.
  const document_url = new URL(list_peek(entry.urls));
  set_document_base_uri(document, document_url);


  await transform_document(document, console);
  entry.content = document.documentElement.outerHTML;
}

function build_rewrite_rules() {
  const rules = [];
  rules.push(google_news_rule);
  rules.push(techcrunch_rule);
  rules.push(facebook_exit_rule);
  return rules;
}

function google_news_rule(url) {
  if (url.hostname === 'news.google.com' && url.pathname === '/news/url') {
    const param = url.searchParams.get('url');
    try {
      return new URL(param);
    } catch (error) {
    }
  }
}

function techcrunch_rule(url) {
  if (url.hostname === 'techcrunch.com' && url.searchParams.has('ncid')) {
    const output = new URL(url.href);
    output.searchParams.delete('ncid');
    return output;
  }
}

function facebook_exit_rule(url) {
  if (url.hostname === 'l.facebook.com' && url.pathname === '/l.php') {
    const param = url.searchParams.get('u');
    try {
      return new URL(param);
    } catch (error) {
    }
  }
}

/*
# poll-entry
Processes an entry and possibly adds it to the database. The full-text html of
the entry is fetched and stored as `entry.content`.

### Context properties
* **rconn** {IDBDatabase} required
* **iconn** {IDBDatabase} required
* **channel** {BroadcastChannel} required
* **console** {Object} required
* **fetch_html_timeout** {Number} optional
* **fetch_image_timeout** {Number} optional

### Params
* **entry** {object}

### Misc implementation notes
* url rewriting always occurs before checking whether a url exists. The original
url is not checked. This reduces the number of checks that must occur.

### TODOs
* There are a lot of parameters. Brainstorming, one idea would be to use
thisArg, shove several of the parameters into this so-called context, access
them via this.property within the function body, and then require the caller to
use function.call to call the function. Basically split up the parameters into
two places. This has pros/cons. It becomes more difficult to call the function
because it requires the use of call. However, the calling code becomes more
readable and less error-prone, because I do not have such a gigantic parameter
list.
* Revisit how existence check works regarding uniqueness errors. Basically the
`db_write_entry` call can fail because of the uniqueness constraint placed on
the url index of the entry store when the incoming entry has a url that already
exists. This currently does two checks, an explicit check up front and then the
implied check that happens within `db_write_entry` when calling
`IDBObjectStore.prototype.put`. First, I do not like the duplicate functionality
and prefer a design where there is only one check. Second, I would prefer to
somehow do this using a single database transaction instead of multiple
transactions. Third, I would prefer that I did not have to wrap the call to
`db_write_entry` in a try/catch block, because the call should basically never
fail, but it can in the current implementation so I must.
* I would prefer to use a single transaction for all entries. Now that this
function is isolated into its own module, it is ignorant of the fact that it is
likely being called repeatedly for several entries coming from a feed. It
creates numerous individual transactions. This can lead to integrity issues. It
can also lead to the aforementioned issue with duplicate urls. I dedup urls in
poll-feed but this is only a weak guarantee of uniqueness, and furthermore, this
module now that it is isolated technically has no knowledge of that behavior
(and correctly should not?). What if I were to do something like require a
transaction as a parameter, instead of the database connection handle, and
operated on that transaction? What about the issues with indexedDB timing out
inactive transactions though? I have interspersed async calls.
* This only inspects the tail, not all urls. It is possible due to some poorly
implemented logic that one of the other urls in the entry's url list exists in
the db At the moment I am more included to allow the indexedDB put request that
happens later to fail due to a constraint error. This function is more of an
attempt at reducing processing than maintaining data integrity.
* Consider removing the try/catch when checking the entry's icon. Favicon lookup
failure is not fatal to polling an entry. Rather than require the caller to
handle the error, handle the error locally. If the favicon lookup only fails in
event of a critical error, such as a programming error or database error, then
it actually should be fatal, and this shouldn't use try/catch. However, I've
forgotten all the specific cases of when the lookup throws. If it throws in case
of failed fetch for example that is not a critical error. For now I am leaving
in the try/catch. But, I should consider removing it.
* When setting up the options for the document-transform call, the min contrast
ratio should be loaded from local storage once, not per call here. I don't care
if it changes from call to call, use the initial value
* probably should just accept a url as input instead of an entry object, and
give up on handling local-content entirely

*/
