import assert from '/src/lib/assert.js';
import filter_controls from '/src/lib/filter-controls.js';
import filter_unprintables from '/src/lib/filter-unprintables.js';
import remove_html from '/src/lib/remove-html.js';
import truncate_html from '/src/lib/truncate-html.js';

// Known resource property names
const resource_props = [
  'active',
  'archived_date',
  'archive_state',
  'author',
  'content',
  'created_date',
  'deactivation_date',
  'deactivation_reason',
  'description',
  'enclosure',
  'favicon_url',
  'feed',
  'feed_title',
  'id',
  'link',
  'published_date',
  'read_date',
  'read_state',
  'title',
  'type',
  'updated_date',
  'urls'
];


// Returns whether the given value represents a valid object identifier in the
// datbase
export function is_valid_id(value) {
  return Number.isInteger(value) && value > 0;
}

// If a {URL} url is distinct from a resource's other urls, append the url to
// the resource. Returns whether appended. This accepts a url object instead
// of a string to ensure the url is well-formed, absolute, and canonical,
// although the url is recorded in string form in the resource's urls list.
export function set_url(resource, url) {
  const url_string = url.href;
  if (resource.urls) {
    if (resource.urls.includes(url_string)) {
      return false;
    }

    resource.urls.push(url_string);
  } else {
    resource.urls = [url_string];
  }

  return true;
}

export function has_url(resource) {
  return resource.urls && resource.urls.length;
}

// Returns the last url in the resource's list of urls as a url string. Throws
// an error if the resource object is not a resource or has no urls.
export function get_url_string(resource) {
  assert(has_url(resource));
  return resource.urls[resource.urls.length - 1];
}

// Returns the last url in the resource's url list as a URL object. Throws an
// error if the resource is invalid or if the resource has no urls or if the
// url is malformed.
export function get_url(resource) {
  return new URL(get_url_string(resource));
}

// Mutate the input resource object such that its properties are normalized. For
// example, strings with different unicode encodings become canonical. This does
// not normalize urls. See https://unicode.org/reports/tr15/ for more info.
export function normalize(resource) {
  if (resource.author) {
    resource.author = resource.author.normalize();
  }

  if (resource.title) {
    resource.title = resource.title.normalize();
  }

  if (resource.content) {
    resource.content = resource.content.normalize();
  }

  if (resource.description) {
    resource.description = resource.description.normalize();
  }
}

export function sanitize(resource, options = {}) {
  for (const prop in resource) {
    if (!resource_props.includes(prop)) {
      console.warn('Unknown resource property not sanitized:', prop);
    }
  }

  const max_title_length =
      isNaN(options.max_title_length) ? 1024 : options.max_title_length;
  const max_description_length = isNaN(options.max_description_length) ?
      10240 :
      options.max_description_length;
  const max_author_length =
      isNaN(options.max_author_length) ? 200 : options.max_author_length;

  if (resource.title) {
    let title = resource.title;
    title = filter_controls(title);
    title = remove_html(title);
    title = condense_whitespace(title);
    title = truncate_html(title, max_title_length, '');
    resource.title = title;
  }

  if (resource.description) {
    let desc = resource.description;
    desc = filter_controls(desc);
    desc = remove_html(desc);
    desc = condense_whitespace(desc);
    desc = truncate_html(desc, max_description_length, '');
    resource.description = desc;
  }

  if (resource.author) {
    let author = resource.author;
    author = filter_controls(author);
    author = remove_html(author);
    author = condense_whitespace(author);
    author = truncate_html(author, max_author_length);
    resource.author = author;
  }

  if (resource.content) {
    let content = resource.content;
    content = filter_unprintables(content);
    resource.content = content;
  }
}

function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}

export function validate(resource) {
  assert(resource && typeof resource === 'object');

  const now = new Date();

  vassert(
      resource.favicon_url === undefined ||
      typeof resource.favicon_url === 'string');

  vassert(
      resource.active === undefined || resource.active === true ||
      resource.active === false);

  vassert(
      resource.type === undefined || resource.type === 'rss' ||
      resource.type === 'feed' || resource.type === 'rdf');

  vassert(resource.link === undefined || typeof resource.link === 'string');

  vassert(resource.id === undefined || is_valid_id(resource.id));
  vassert(resource.feed === undefined || is_valid_id(resource.feed));

  vassert(
      resource.feed_title === undefined ||
      typeof resource.feed_title === 'string');

  vassert(resource.urls === undefined || Array.isArray(resource.urls));
  vassert(
      resource.read_state === undefined || resource.read_state === 1 ||
      resource.read_state === 0);
  vassert(
      resource.archive_state === undefined || resource.archive_state === 1 ||
      resource.archive_state === 0);
  vassert(resource.author === undefined || typeof resource.author === 'string');
  vassert(resource.title === undefined || typeof resource.title === 'string');
  vassert(
      resource.description === undefined ||
      typeof resource.description === 'string');

  vassert(
      resource.content === undefined || typeof resource.content === 'string');

  vassert(
      resource.deactivation_reason === undefined ||
      typeof resource.deactivation_reason === 'string');

  vassert(is_valid_date(resource.archived_date));
  vassert(is_valid_date(resource.read_date));


  vassert(is_valid_date(resource.deactivation_date));
  vassert(is_date_lte(resource.deactivation_date, now));

  vassert(is_valid_date(resource.created_date));
  vassert(is_date_lte(resource.created_date, now));
  vassert(is_valid_date(resource.updated_date));
  vassert(is_date_lte(resource.updated_date, now));
  vassert(is_date_lte(resource.created_date, resource.updated_date));
  vassert(is_valid_date(resource.published_date));
  vassert(is_date_lte(resource.published_date, now));

  if (resource.enclosure) {
    vassert(typeof resource.enclosure === 'object');
    const url = resource.enclosure.url;
    vassert(url === undefined || url === null || typeof url === 'string');
    const len = resource.enclosure.enclosure_length;
    vassert(len === undefined || len === null || typeof len === 'string');
    const type = resource.enclosure.type;
    vassert(type === undefined || type === null || typeof type === 'string');
  }
}

function is_valid_date(value) {
  return value === undefined || !isNaN(value.getTime());
}

function is_date_lte(date1, date2) {
  return date1 === undefined || date2 === undefined || date1 <= date2;
}

// An assertion-like utility for throwing validation errors
function vassert(condition, message) {
  if (!condition) {
    throw new ValidationError(message);
  }
}

class ValidationError extends Error {
  constructor(message = 'Validation error') {
    super(message);
  }
}
