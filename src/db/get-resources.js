import assert from '/src/lib/assert.js';

export default function get_resources(query) {
  return new Promise(get_resources_executor.bind(this, query));
}

function get_resources_executor(query, resolve, reject) {
  assert(query && typeof query === 'object');

  const modes = [
    'all', 'feeds', 'active-feeds', 'viewable-entries', 'archivable-entries'
  ];
  assert(modes.includes(query.mode));
  assert(is_valid_offset(query.offset));
  assert(is_valid_limit(query.limit));

  const resources = [];

  const transaction = query.conn.conn.transaction('resources');
  transaction.oncomplete =
      transaction_oncomplete.bind(transaction, resources, query, resolve);
  transaction.onerror = event => reject(event.target.error);

  const store = transaction.objectStore('resources');

  const request = open_cursor_request(query, store);

  const context = {};
  context.mode = query.mode;
  context.skip_count = 0;
  context.resources = resources;
  context.offset = query.offset;
  context.limit = query.limit;

  request.onsuccess = request_onsuccess.bind(request, context);
}

function request_onsuccess(context, event) {
  const cursor = event.target.result;
  if (!cursor) {
    return;
  }

  const resource = cursor.value;

  // If the resource does not match the query then skip past it entirely. This
  // does not contribute to the offset calculation.
  if (!resource_matches_query(context.mode, resource)) {
    cursor.continue();
    return;
  }

  // Keep advancing until we reached offset
  if (context.offset > 0 && context.skip_count < context.offset) {
    context.skip_count++;
    cursor.continue();
    return;
  }

  context.resources.push(resource);

  if (context.limit > 0) {
    if (context.resources.length < context.limit) {
      cursor.continue();
    } else {
      // done (limit reached)
    }
  } else {
    // unlimited, always continue
    cursor.continue();
  }
}

function resource_matches_query(mode, resource) {
  if (mode === 'all') {
    return true;
  }

  if (mode === 'feeds') {
    return resource.type === 'feed';
  }

  if (mode === 'viewable-entries') {
    return resource.type === 'entry' && resource.archived === 0 &&
        resource.read === 0;
  }

  if (mode === 'archivable-entries') {
    return resource.type === 'entry' && resource.archived === 0 &&
        resource.read === 1;
  }

  if (mode === 'active-feeds') {
    return resource.type === 'feed' && resource.active === 1;
  }

  return false;
}

function open_cursor_request(query, store) {
  if (query.mode === 'all') {
    return store.openCursor();
  }

  if (query.mode === 'feeds') {
    const index = store.index('type');
    return index.openCursor('feed');
  }

  if (query.mode === 'active-feeds') {
    const index = store.index('type');
    return index.openCursor('feed');
  }

  if (query.mode === 'viewable-entries' ||
      query.mode === 'archivable-entries') {
    const index = store.index('type');
    return index.openCursor('entry');
  }

  throw new TypeError('Invalid mode ' + query.mode);
}

function transaction_oncomplete(resources, query, callback, event) {
  if (query.title_sort) {
    resources.sort(compare_resource_titles);
  }

  callback(resources);
}

function compare_resource_titles(a, b) {
  const s1 = a.title ? a.title.toLowerCase() : '';
  const s2 = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(s1, s2);
}

function is_valid_offset(offset) {
  return offset === null || offset === undefined || offset === NaN ||
      (Number.isInteger(offset) && offset >= 0);
}

function is_valid_limit(limit) {
  return limit === null || limit === undefined || limit === NaN ||
      (Number.isInteger(limit) && limit >= 0);
}
