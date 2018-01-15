import * as Status from "/src/common/status.js";

import unsubscribe as unsubscribeWithConn from "/src/feed-ops/unsubscribe.js";

import {
  activateFeed as activateFeedWithConn,
  deactivateFeed as deactivateFeedWithConn,
  findFeedById as findFeedByIdWithConn,
  open as openFeedStore
} from "/src/feed-store/feed-store.js";

// This module exports a variety of functions from feed-store and feed-ops
// where the connection parameter is implied. Operations are generally designed
// so that multiple operations can share the same connection. However, in
// several cases an operation never uses a shared connection, it always has
// to create its own connection, perform its work, and then close its connection.
// That leads to a lot of boilerplate, and it is annoying enough to me that I've
// created this module.

export async function activateFeed(channel, feedId) {

  let [status, conn] = await openFeedStore();
  if(status !== Status.OK) {
    console.error('Failed to open feed store', Status.toString(status));
    return;
  }

  status = await activateFeedWithConn(conn, channel, feedId);
  if(status !== Status.OK) {
    console.error('Failed to activate feed', Status.toString(status));
  }

  conn.close();
  return status;
}

export async function deactivateFeed(channel, feedId, reasonText) {
  let [status, conn] = await openFeedStore();
  if(status !== Status.OK) {
    console.error('Failed to open database', Status.toString(status));
    return status;
  }

  status = await deactivateFeedWithConn(conn, channel, feedId, reasonText);
  if(status !== Status.OK) {
    console.error('Failed to deactivate feed', Status.toString(status));
  }

  conn.close();
  return status;
}


export async function findFeedById(feedId) {
  let [status, conn] = await openFeedStore();
  if(status !== Status.OK) {
    console.error('Failed to open feed store', Status.toString(status));
    return [status];
  }
  let feed;
  [status, feed] = await findFeedByIdWithConn(conn, feedId);
  if(status !== Status.OK) {
    console.error('Failed to find feed by id %d', feedId, Status.toString(status));
  }
  conn.close();
  return [status, feed];
}

export async function getAllFeeds() {
  let [status, conn] = await openFeedStore();
  if(status !== Status.OK) {
    console.error('Failed to open feed store:', Status.toString(status));
    return [status];
  }

  let feeds;
  [status, feeds] = await getAllFeeds(conn);
  if(status !== Status.OK) {
    console.error('Failed to get all feeds:', Status.toString(status));
  }

  conn.close();
  return [status, feeds];
}


export async function unsubscribe(channel, feedId) {
  let [status, conn] = await openFeedStore();
  if(status !== Status.OK) {
    console.error('Failed to open database:', Status.toString(status));
    return status;
  }

  status = await unsubscribeWithConn(conn, channel, feedId);
  if(status !== Status.OK) {
    console.error('Failed to unsubscribe:', Status.toString(status));
  }

  conn.close();
  return status;
}
