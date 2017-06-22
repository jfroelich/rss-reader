// See license.md

'use strict';

// TODO: need to update all uses of SubscriptionService
// - the params changed
// - also for unsubscribe

const subscribeDefaultOptions = {
  'fetchFeedTimeoutMillis': 2000,
  'suppressNotifications': false
};

// Returns the feed that was added if successful
async subscribe(dbConn, iconDbConn, feedObject,
  options = subscribeDefaultOptions, logObject) {

  const urlString = feedGetURLString(feedObject);

  if(logObject) {
    logObject.log('Subscribing to feed with url', urlString);
  }

  const isExistingURL = await dbContainsFeedURL(dbConn, urlString);
  if(isExistingURL) {
    if(logObject) {
      logObject.warn('Already subscribed to feed with url', urlString);
    }

    return;
  }

  // Offline subscription
  if('onLine' in navigator && !navigator.onLine) {
    if(logObject) {
      logObject.warn('Proceeding with offline subscription to', urlString);
    }

    const addedFeed = await dbAddFeed(dbConn, feedObject);
    return addedFeed;
  }

  let remoteFeedObject;

  try {
    const fetchResultObject = await fetchFeed(urlString,
      options.fetchFeedTimeoutMillis);
    remoteFeedObject = fetchResultObject.feed;
  } catch(error) {
    if(logObject) {
      logObject.warn('Failed to subscribe due to fetch failure', urlString);
    }

    return;
  }

  // Check if redirect url exists
  const isRedirect = remoteFeedObject.urls.length > 1;
  if(isRedirect) {
    const redirectURLString = feedGetURLString(remoteFeedObject);
    const isExistingRedirectURL = await dbContainsFeedURL(dbConn,
      redirectURLString);

    if(isExistingRedirectURL) {
      if(logObject) {
        logObject.warn('Already subscribed to feed with redirected url',
          redirectURLString);
      }

      return;
    }
  }

  const mergedFeedObject = feedMerge(feedObject, remoteFeedObject);
  await subscribeSetFeedFavicon(iconDbConn, mergedFeedObject, logObject);
  const addedFeed = await dbAddFeed(dbConn, mergedFeedObject);

  if(!options.suppressNotifications) {
    subscribeShowNotification(addedFeed);
  }

  return addedFeed;
}

async subscribeSetFeedFavicon(iconDbConn, feedObject, logObject) {
  const lookupURLObject = jrFeedIconGetLookupURL(feedObject);

  // Lookup errors are not fatal so suppress any exceptions
  // TODO: should that be caller's responsibility?
  try {
    const iconURLString = await jrFaviconLookup(iconDbConn, lookupURLObject);
    feedObject.faviconURLString = iconURLString;
  } catch(error) {
    if(logObject) {
      logObject.warn(error);
    }
  }
}

function subscribeShowNotification(feedObject) {
  const title = 'Subscription complete';
  const feedName = feedObject.title || feedGetURLString(feedObject);
  const message = 'Subscribed to ' + feedName;
  showNotification(title, message, feedObject.faviconURLString);
}
