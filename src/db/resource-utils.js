import assert from '/src/lib/assert.js';
import filterControls from '/src/lib/filter-controls.js';
import filterUnprintables from '/src/lib/filter-unprintables.js';
import removeHTML from '/src/lib/remove-html.js';
import truncateHTML from '/src/lib/truncate-html.js';

const knownResourcePropertyNames = [
  'active',
  'archived_date',
  'archived',
  'author',
  'content',
  'created_date',
  'deactivation_date',
  'deactivation_reason',
  'description',
  'enclosure',
  'favicon_url',
  'feed',
  'feed_format',
  'feed_title',
  'id',
  'link',
  'parent',
  'published_date',
  'read_date',
  'read',
  'title',
  'type',
  'updated_date',
  'urls'
];

// Return true if value represents a well-formed resource identifier. This does not warrant the id
// exists in the database.
export function isValidId(value) {
  return Number.isInteger(value) && value > 0;
}

// If a {URL} url is distinct from a resource's other urls, append the url to the resource. Returns
// whether appended. This accepts a url object instead of a string to ensure the url is well-formed,
// absolute, and canonical, although the url is recorded in string form in the resource's urls list.
export function setURL(resource, url) {
  const urlString = url.href;
  if (resource.urls) {
    if (resource.urls.includes(urlString)) {
      return false;
    }

    resource.urls.push(urlString);
  } else {
    resource.urls = [urlString];
  }

  return true;
}

// Mutate the input resource object such that its properties are normalized. For example, strings
// with different unicode encodings become canonical. This does not normalize urls. See
// https://unicode.org/reports/tr15/.
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
  // Whine about unknown properties to discourage use
  for (const prop in resource) {
    if (!knownResourcePropertyNames.includes(prop)) {
      console.warn('Unknown resource property not sanitized:', prop);
    }
  }

  // Remove type-specific properties specified for the wrong type, and whine about it. This is not
  // exhaustive at the moment.

  if (resource.type === 'feed' && 'archived_date' in resource) {
    console.warn('Removing entry-only property from resource:', resource);
    delete resource.archived_date;
  }

  if (resource.type === 'entry' && 'active' in resource) {
    console.warn('Removing feed-only property from resource:', resource);
    delete resource.active;
  }

  if (resource.type === 'entry' && 'feed_format' in resource) {
    console.warn('Removing feed-only property "%s" from resource:', 'feed_format', resource);
  }

  const maxTitleLength = isNaN(options.maxTitleLength) ? 1024 : options.maxTitleLength;
  const maxDescriptionLength = isNaN(options.maxDescriptionLength) ?
    10240 : options.maxDescriptionLength;
  const maxAuthorLength = isNaN(options.maxAuthorLength) ? 200 : options.maxAuthorLength;

  if (resource.title) {
    let { title } = resource;
    title = filterControls(title);

    try {
      title = removeHTML(title);
    } catch (error) {
      title = 'Unsafe html';
    }

    title = condenseWhitespace(title);
    title = truncateHTML(title, maxTitleLength, '');
    resource.title = title;
  }

  if (resource.description) {
    let { description } = resource;
    description = filterControls(description);

    try {
      description = removeHTML(description);
    } catch (error) {
      description = 'Unsafe html';
    }

    description = condenseWhitespace(description);
    description = truncateHTML(description, maxDescriptionLength, '');
    resource.description = description;
  }

  if (resource.author) {
    let { author } = resource;
    author = filterControls(author);

    try {
      author = removeHTML(author);
    } catch (error) {
      author = 'Unsafe html';
    }

    author = condenseWhitespace(author);
    author = truncateHTML(author, maxAuthorLength);
    resource.author = author;
  }

  if (resource.content) {
    let { content } = resource;
    content = filterUnprintables(content);
    resource.content = content;
  }
}

function condenseWhitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}

export function validate(resource) {
  assert(resource && typeof resource === 'object');
  const now = new Date();

  // TODO: eventually improve validation of the type property. we have to support undefined to
  // support the patch-resource use case where there is no delta property for type set, but validate
  // is called on the delta itself. but in reality all resources should have a valid type.
  vassert(resource.type === 'entry' || resource.type === 'feed' || resource.type === undefined);
  vassert(resource.favicon_url === undefined || typeof resource.favicon_url === 'string');
  vassert(resource.active === undefined || resource.active === 1 || resource.active === 0);
  const formats = ['rss', 'feed', 'rdf'];
  vassert(resource.feed_format === undefined || formats.includes(resource.feed_format));
  vassert(resource.link === undefined || typeof resource.link === 'string');
  vassert(resource.id === undefined || isValidId(resource.id));
  vassert(resource.feed === undefined || isValidId(resource.feed));
  vassert(resource.feed_title === undefined || typeof resource.feed_title === 'string');
  vassert(resource.urls === undefined || Array.isArray(resource.urls));
  vassert(resource.read === undefined || resource.read === 1 || resource.read === 0);
  vassert(resource.archived === undefined || resource.archived === 1 || resource.archived === 0);
  vassert(resource.author === undefined || typeof resource.author === 'string');
  vassert(resource.title === undefined || typeof resource.title === 'string');
  vassert(resource.description === undefined || typeof resource.description === 'string');
  vassert(resource.content === undefined || typeof resource.content === 'string');
  vassert(resource.deactivation_reason === undefined ||
    typeof resource.deactivation_reason === 'string');
  vassert(isValidDate(resource.archived_date));
  vassert(isValidDate(resource.read_date));
  vassert(isValidDate(resource.deactivation_date));
  vassert(isDateLTE(resource.deactivation_date, now));
  vassert(isValidDate(resource.created_date));
  vassert(isDateLTE(resource.created_date, now));
  vassert(isValidDate(resource.updated_date));
  vassert(isDateLTE(resource.updated_date, now));
  vassert(isDateLTE(resource.created_date, resource.updated_date));
  vassert(isValidDate(resource.published_date));
  vassert(isDateLTE(resource.published_date, now));

  if (resource.enclosure) {
    vassert(typeof resource.enclosure === 'object');
    const { url } = resource.enclosure;
    vassert(url === undefined || url === null || typeof url === 'string');
    const { enclosure_length: enclosureLength } = resource.enclosure;
    vassert(enclosureLength === undefined || enclosureLength === null ||
      typeof enclosureLength === 'string');
    const { type } = resource.enclosure;
    vassert(type === undefined || type === null || typeof type === 'string');
  }
}

function isValidDate(value) {
  return value === undefined || !isNaN(value.getTime());
}

function isDateLTE(date1, date2) {
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
