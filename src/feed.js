// See license.md

'use strict';

// Utility functions related to working with feeds and entries
function Feed() {}

// Get the url currently representing the feed, which is the final url in its
// internal urls array.
Feed.prototype.get_url = function() {
  const urls = this.urls;
  if(!urls.length)
    throw new Error('feed.urls is empty');
  return urls[urls.length - 1];
};

Feed.prototype.add_url = function(url_string) {
  this.urls = this.urls || [];
  const url_object = new URL(url_string);
  const norm_url_string = url_object.href;
  if(this.urls.includes(norm_url_string))
    return false;
  this.urls.push(norm_url_string);
  return true;
};

// Creates a url object that can be used as input to favicon_lookup
// @returns {URL}
Feed.prototype.create_icon_lookup_url = function() {
  // Cannot assume the link is set nor valid
  if(this.link) {
    try {
      return new URL(this.link);
    } catch(error) {
      // console.warn(error);
    }
  }

  // If the link is missing or invalid then use the origin
  // Assume the feed always has a url.
  // Due to expected custom 'this' binding use call, because getURL may not
  // exist on 'this' as a function
  const url_string = Feed.prototype.get_url.call(this);
  const url_object = new URL(url_string);
  const origin_url_string = url_object.origin;
  return new URL(origin_url_string);
};

// Returns a shallow copy of the input feed with sanitized properties
// TODO: sanitize is not same as validate, this should not validate, this is
// a conflation of functionality
Feed.prototype.sanitize = function(title_max_length, desc_max_length) {

  if(typeof title_max_length === 'undefined')
    title_max_length = 1024;
  if(typeof desc_max_length === 'undefined')
    desc_max_length = 1024 * 10;

  const output_feed = Object.assign({}, this);

  if(output_feed.id) {
    if(!Number.isInteger(output_feed.id) || output_feed.id < 1)
      throw new TypeError('Invalid feed id');
  }

  const types = {'feed': 1, 'rss': 1, 'rdf': 1};
  if(output_feed.type && !(output_feed.type in types))
    throw new TypeError();

  if(output_feed.title) {
    let title = output_feed.title;
    title = filter_control_chars(title);
    title = replace_html(title, '');
    title = title.replace(/\s+/, ' ');
    title = truncate_html(title, title_max_length, '');
    output_feed.title = title;
  }

  if(output_feed.description) {
    let description = output_feed.description;
    description = filter_control_chars(description);
    description = replace_html(description, '');
    description = description.replace(/\s+/, ' ');
    const before_length = description.length;
    description = truncate_html(description, desc_max_length, '');

    //if(before_length > description.length) {
      // console.warn('Truncated description', description);
    //}

    output_feed.description = description;
  }

  return output_feed;
};

// Returns a new object that results from merging the old feed with the new
// feed. Fields from the new feed take precedence, except for URLs, which are
// merged to generate a distinct ordered set of oldest to newest url. Impure
// because of copying by reference.
function merge_feeds(old_feed_object, new_feed_object) {
  const merged_feed_object = Object.assign({}, old_feed_object,
    new_feed_object);
  merged_feed_object.urls = [...old_feed_object.urls];
  if(new_feed_object.urls)
    for(const url_string of new_feed_object.urls)
      Feed.prototype.add_url.call(merged_feed_object, url_string);
  else
    console.warn('Did not merge any new feed urls', old_feed_object,
      new_feed_object);
  return merged_feed_object;
}

const ENTRY_STATE_UNREAD = 0;
const ENTRY_STATE_READ = 1;
const ENTRY_STATE_UNARCHIVED = 0;
const ENTRY_STATE_ARCHIVED = 1;

function entry_get_url_string(entry) {
  if(!entry.urls.length)
    throw new TypeError('Entry object has no urls');
  return entry.urls[entry.urls.length - 1];
}

// Append a url to the entry's internal url list. Lazily creates the list if
// need. Also normalizes the url. Returns false if the url already exists and
// was not added
function entry_add_url_string(entry, url_string) {
  const normalizedURLObject = new URL(url_string);
  if(entry.urls) {
    if(entry.urls.includes(normalizedURLObject.href)) {
      return false;
    }
    entry.urls.push(normalizedURLObject.href);
  } else {
    entry.urls = [normalizedURLObject.href];
  }

  return true;
}

// Throws an exception if 'this' feed is not suitable for storage. The
// objective is to prevent garbage data from entering the database.
// @param min_date {Date} optional, the oldest date allowed for date properties,
// defaults to Jan 1, 1970.
// NOTE: not fully implemented
// NOTE: only validating date objects, not fully validating actual dates such
// as if day of month > 31 or whatever
// TODO: assert required properties are present
// TODO: assert dates are not in the future
// TODO: assert dates are not too far in the past
// TODO: assert type, if set, is one of the valid types
// TODO: assert feed has one or more urls
// TODO: assert the type of each property?
// TODO: add to appropriate calling contexts (e.g. whereever prep for storage
// is done).
Feed.prototype.assert_valid = function(min_date, is_id_required) {
  const default_min_date = new Date(0);
  const to_string = Object.prototype.toString;
  const max_date = new Date();

  if(typeof min_date === 'undefined')
    min_date = default_min_date;

  // Validate the min_date parameter itself before using it
  if(to_string.call(min_date) !== '[object Date]')
    throw new TypeError('min_date is not a date object');
  else if(isNaN(min_date.getTime()))
    throw new TypeError('min_date.getTime() is nan');
  else if(min_date < default_min_date)
    throw new TypeError('min_date is too old');
  else if(min_date > max_date)
    throw new TypeError('min_date > max_date');

  if(typeof this !== 'object')
    throw new Error('this is not an object' );

  // this.id is optional because it does not exist when adding a feed to the
  // datababse.
  if('id' in this) {
    if(isNan(this.id))
      throw new Error('id is not a number');
    else if(id < 0)
      throw new Error('id is negative');
    else if(!Number.isInteger(id))
      throw new Error('id is not an integer');
  } else if(is_id_required)
    throw new Error('feed missing required id');



  // TODO: unsure whether this is even a property at the moment, just
  // wondering about how the validation would look
  if('dateUpdated' in this) {
    if(to_string.call(this.dateUpdated) !== '[object Date]') {
      throw new Error('dateUpdated is not a date object: ' + this.dateUpdated);
    } else if(isNaN(this.dateUpdated.getTime())) {
      throw new Error('dateUpdated.getTime() is nan: ' + this.dateUpdated);
    } else if(this.dateUpdated < min_date) {
      throw new Error('dateUpdated < min_date: ' + this.dateUpdated);
    } else if(this.dateUpdated > max_date) {
      throw new Error('dateUpdated > max_date: ' + this.dateUpdated);
    }
  }

};


// Returns a new entry object where fields have been sanitized. Impure
function entry_sanitize(input_entry, author_max_length, title_max_length,
  content_max_length) {
  function condense_whitespace(string) {
    return string.replace(/\s{2,}/g, ' ');
  }

  if(typeof author_max_length === 'undefined')
    author_max_length = 200;
  if(typeof title_max_length === 'undefined')
    title_max_length = 1000;
  if(typeof content_max_length === 'undefined')
    content_max_length = 50000;

  const output_entry = Object.assign({}, input_entry);

  if(output_entry.author) {
    let author = output_entry.author;
    author = filter_control_chars(author);
    author = replace_html(author, '');
    author = condense_whitespace(author);
    author = truncate_html(author, author_max_length);
    output_entry.author = author;
  }

  // Condensing node whitespace is handled separately
  // TODO: filter out non-printable characters other than \r\n\t
  if(output_entry.content) {
    let content = output_entry.content;
    content = truncate_html(content, content_max_length);
    output_entry.content = content;
  }

  if(output_entry.title) {
    let title = output_entry.title;
    title = filter_control_chars(title);
    title = replace_html(title, '');
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_length);
    output_entry.title = title;
  }

  return output_entry;
}
