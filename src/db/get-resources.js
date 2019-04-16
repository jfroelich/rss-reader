import assert from '/src/lib/assert.js';

export default function getResources(conn, query) {
  return new Promise(getResourcesExecutor.bind(this, conn, query));
}

function getResourcesExecutor(conn, query, resolve, reject) {
  assert(query && typeof query === 'object');

  const modes = [
    'all', 'feeds', 'active-feeds', 'viewable-entries', 'archivable-entries'
  ];
  assert(modes.includes(query.mode));
  assert(isValidOffset(query.offset));
  assert(isValidLimit(query.limit));

  const resources = [];

  const transaction = conn.conn.transaction('resources');
  transaction.oncomplete = transactionOncomplete.bind(transaction, resources, query, resolve);
  transaction.onerror = event => reject(event.target.error);

  const store = transaction.objectStore('resources');

  const request = openCursorRequest(query, store);

  const context = {};
  context.mode = query.mode;
  context.skipCount = 0;
  context.resources = resources;
  context.offset = query.offset;
  context.limit = query.limit;

  request.onsuccess = requestOnsuccess.bind(request, context);
}

function requestOnsuccess(context, event) {
  const cursor = event.target.result;
  if (!cursor) {
    return;
  }

  const resource = cursor.value;

  // If the resource does not match the query then skip past it entirely. This
  // does not contribute to the offset calculation.
  if (!resourceMatchesQuery(context.mode, resource)) {
    cursor.continue();
    return;
  }

  // Keep advancing until we reached offset
  if (context.offset > 0 && context.skipCount < context.offset) {
    context.skipCount += 1;
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

function resourceMatchesQuery(mode, resource) {
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

function openCursorRequest(query, store) {
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

  throw new TypeError(`Invalid mode ${query.mode}`);
}

function transactionOncomplete(resources, query, callback) {
  if (query.titleSort) {
    resources.sort(compareResourceTitles);
  }

  callback(resources);
}

function compareResourceTitles(a, b) {
  const s1 = a.title ? a.title.toLowerCase() : '';
  const s2 = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(s1, s2);
}

function isValidOffset(offset) {
  return offset === null || offset === undefined || isNaN(offset) ||
      (Number.isInteger(offset) && offset >= 0);
}

function isValidLimit(limit) {
  return limit === null || limit === undefined || isNaN(limit) ||
      (Number.isInteger(limit) && limit >= 0);
}
