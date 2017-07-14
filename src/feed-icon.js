// See license.md

'use strict';

// Scans through all the feeds in the database and attempts to update each
// feed's favicon property.
async function refreshFeedIcons(verbose) {
  let numModified = 0;

  try {
    // Open both database connections concurrently
    const connections = await Promise.all([db.connect(),
      favicon.connect()]);

    // Load all feeds from the database
    const feeds = await db.getFeeds(connections[0]);

    if(verbose) {
      console.log('Loaded %d feeds', feeds.length);
    }

    const lookupPromises = new Array(feeds.length);
    for(let feed of feeds) {
      // A non-awaited async function call returns a promise
      const lookupPromise = lookupFeedIconAndUpdateFeed(feed, connections[0],
        connections[1], verbose);
      lookupPromises.push(lookupPromise);
    }

    // Wait for all the lookups to complete, concurrently
    const resolutions = await Promise.all(lookupPromises);

    // Count the number that returned true, which is the number of feeds
    // updated because a new icon was found
    numModified = resolutions.reduce((c, r) => r ? c + 1 : c, 0);
  } finally {

    if(connections[0]) {
      connections[0].close();
    }

    if(connections[1]) {
      connections[1].close();
    }
  }
}

// Returns true if the feed was updated
async function lookupFeedIconAndUpdateFeed(feed, readerConn, iconConn,
  verbose) {

  // NOTE: this needs to somehow exit early and return false if there is no
  // need to lookup the favicon because the time elapsed since the last lookup
  // is not that great. Otherwise we end up pinging lots of websites many
  // times.
  // Actually, this is accomplished by the caching mechanism internal to the
  // favicon library? So maybe it is isn't our concern. All that we really
  // incur is a database lookup from within favicon.lookup, which is basically
  // equivalent to a more explicit database lookup that would be done here.

  const lookupURLObject = createFeedIconLookupURL(feed);

  // Failed to create lookup url
  if(!lookupURLObject) {
    return false;
  }

  const iconURLString = await favicon.lookup(iconConn, lookupURLObject);
  // No favicon found
  if(!iconURLString) {
    return false;
  }

  // When the feed is missing an icon, then we want to set it.
  // When the feed is not missing an icon, then we only want to set it if the
  // newly found icon is different than the current icon.

  if(feed.faviconURLString === iconURLString) {
    return false;
  }

  if(verbose) {
    console.log('Changing feed icon url from %s to %s', feed.faviconURLString,
      iconURLString);
  }

  // Otherwise the icon changed, or the feed was missing an icon
  feed.faviconURLString = iconURLString;
  await db.putFeed(readerConn, feed);
  return true;
}
