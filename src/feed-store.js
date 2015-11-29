// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const FeedStore = {};

// Queries the database for a feed with the given url
FeedStore.findByURL = function(connection, url, callback) {
	const transaction = connection.transaction('feed');
	const store = transaction.objectStore('feed');
	const index = store.index('schemeless');
	const schemeless = URLUtils.getSchemeless(url);
	const request = index.get(schemeless);
	request.onsuccess = callback;
};

// Queries the database for a feed with the given id
FeedStore.findById = function(connection, id, callback) {
	const transaction = connection.transaction('feed');
	const store = transaction.objectStore('feed');
	const request = store.get(id);
	request.onsuccess = callback;
};

// Iterates over each feed in the database, calling handleFeed.
// Calls callback when iteration completes. Note that due to the
// async nature of this function, it is possible for callback to
// be called prior to every handleFeed call completing.
FeedStore.forEach = function(connection, handleFeed, sortByTitle, callback) {
	const transaction = connection.transaction('feed');
	transaction.oncomplete = callback;

	let store = transaction.objectStore('feed');
	if(sortByTitle) {
		store = store.index('title');
	}

	const request = store.openCursor();
	request.onsuccess = function(event) {
		const cursor = event.target.result;
		if(cursor) {
			handleFeed(cursor.value);
			cursor.continue();
		}
	};
};

// Removes the corresponding feed from the database
FeedStore.remove = function(connection, id, callback) {
	const transaction = connection.transaction('feed', 'readwrite');
	const store = transaction.objectStore('feed');
	const request = store.delete(id);
	request.onsuccess = callback;
};

// Removes the corresponding feed from the database along
// with any corresponding entries
// TODO: deprecate or move into some other lib
FeedStore.unsubscribe = function(connection, id, callback) {
	FeedStore.remove(connection, id, function(event) {
		EntryStore.removeByFeed(connection, id, callback);
	});
};

{ // BEGIN ANONYMOUS NAMESPACE

// Adds/updates the feed in the database.
// @param original the feed as it was loaded from the database prior
// to update. Optional. If specified, certain properties from the original
// are maintained in the updated feed object.
// @param feed the object containing new feed properties
// TODO: check last modified date of the remote xml file to avoid
// pointless updates?
// TODO: ensure the date is not beyond the current date?
// TODO: maybe not modify date updated if not dirty
FeedStore.put = function(connection, original, feed, callback) {

	const storable = {};

	// Maintain the same id if doing an update
	if(original) {
		storable.id = original.id;
	}

	storable.url = feed.url;

	// Record the type property (the feed's original format)
	if(feed.hasOwnProperty('type')) {
		storable.type = feed.type;
	}

	if(original) {
		storable.schemeless = original.schemeless;
	} else {
		storable.schemeless = URLUtils.getSchemeless(storable.url);
	}

	const title = sanitizeValue(feed.title);
	storable.title = title || '';

	const description = sanitizeValue(feed.description);
	if(description) {
		storable.description = description;
	}

	const link = sanitizeValue(feed.link);
	if(link) {
		storable.link = link;
	}

	if(feed.date) {
		storable.date = feed.date;
	}

	if(feed.fetched) {
		storable.fetched = feed.fetched;
	}

	if(original) {
		storable.updated = Date.now();
		storable.created = original.created;
	} else {
		storable.created = Date.now();
	}

	const transaction = connection.transaction('feed', 'readwrite');
	const store = transaction.objectStore('feed');
	const request = store.put(storable);
	transaction.oncomplete = onPutFeed.bind(transaction, callback);
};

function onPutFeed(callback, event) {
	// Temporary, just log any errors
	if(event.target.error) {
		console.debug('Error putting feed %s', storable.url);
		console.dir(event);
	}

	callback();
}

// Clean up a string value
// TODO: sanitize html entities?
function sanitizeValue(value) {
	if(value) {
		value = StringUtils.removeTags(value);
		value = StringUtils.stripControlCharacters(value);
		value = value.replace(/\s+/, ' ');
		value = value.trim();
		return value;
	}
}

} // END ANONYMOUS NAMESPACE
