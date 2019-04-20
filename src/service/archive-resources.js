import * as db from '/src/db/db.js';
import * as DBService from '/src/service/db-service.js';
import assert from '/src/lib/assert.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

// Scans resource storage for resources that are archivable and archives them. Archiving a resource
// object is analogous to compacting the object. Certain properties are deleted. This helps keep the
// size of the resource object store small in storage.
//
// One of the criteria for determining whether a resource is archivable is based on when the
// resource was first created. All resources should have a creation date. However, due to corruption
// it is possible that some do not. This module skips over entries that are missing the date created
// property rather than producing any kind of error.
//
// When archiving a resource, a message is broadcast to the channel that the resource was updated.
//
// @param conn {Connection} an open connection to resource storage
// @param batchSize {Number} optional, the number of resource objects to load into memory at a time
// when scanning through resource storage, defaults to 100. Using a larger value will speed up the
// function because of fewer io operations, but risks OOM/overflow errors. Using a smaller value
// slows down the operation but removes such risks. The larger the average resource object tends to
// be, the smaller this value should be, to proportionally reduce risk. The default of 100 is simply
// a reasonable default that empirically works.
// @param maxAge {Number} optional number in milliseconds used to determine when a resource is
// considered to have expired and should therefore be archived if other conditions are met, defaults
// to two days
// @returns {Promise} a promise that resolves to an array of resource ids that were archived
export default async function archiveResources(conn, batchSize = 100, maxAge = TWO_DAYS_MS) {
  assert(maxAge >= 0);
  assert(Number.isInteger(batchSize) && batchSize > 0);

  const archivedResourceIds = [];
  const currentDate = new Date();

  // We split the criteria for finding archivable resources into two places as an optimization. Part
  // of the query occurs within getEntries which has its own logic for loading candidates. Then we
  // test against the creation date for those entries. This is largely due to the difficulty of
  // executing a range query in getEntries. Obviously it would be preferable not to violate the
  // separation of concerns.

  const query = { mode: 'archivable-entries', offset: 0, limit: batchSize };
  let resources = await DBService.getEntries(conn, query);

  while (resources.length) {
    const batchPatchPromises = [];

    for (const resource of resources) {
      if (resource.created_date && (currentDate - resource.created_date > maxAge)) {
        archivedResourceIds.push(resource.id);
        const delta = {
          id: resource.id,
          title: undefined,
          author: undefined,
          enclosure: undefined,
          content: undefined,
          favicon_url: undefined,
          feed_title: undefined,
          archived: 1
        };

        batchPatchPromises.push(db.patchResource(conn, delta));
      }
    }

    // Wait for all changes to this batch to settle before continuing
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(batchPatchPromises);

    // Only load another batch if we managed to fill the current batch
    if (resources.length === batchSize) {
      // Above we waited for some of the resources to be patched. This will cause our next read
      // transaction to load fewer candidates. We do not simply advance again by batch size or we
      // risk skipping over candidates. If we patched all of the loaded resources then offset should
      // stay at 0 (which it will because unpatch count will be 0 because promises array length will
      // equal batch size). If we patched none of the loaded resources, we want to skip past all of
      // them (which we will because unpatch count will equal batch size so next offset will be the
      // first of the next batch). If we patched only some, then we want to skip over the unpatched
      // ones, so we do not reload them and waste processing or get stuck in an infinite loop.
      const unpatchedCandidateResourcesCount = batchSize - batchPatchPromises.length;
      query.offset += unpatchedCandidateResourcesCount;

      // eslint-disable-next-line no-await-in-loop
      resources = await DBService.getEntries(conn, query);
    } else {
      // Set resources.length to 0 in a nice way to naturally exit the loop
      // We know resources.length > 0 from the loop entry condition
      resources = [];
    }
  }

  return archivedResourceIds;
}
