// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: I would prefer not to hardcode expiration period, I would prefer it
// was defined externally, somewhere else
// TODO: i have a more general idea about dealing with the situation where I
// subscribe to a lot of feeds and then do not bother to read everything and
// so the unread count starts to pile up. I could phase out various entries
// over time. Basically you would have a window in which to read entries, and
// after some point if the entry is still unread, it will never be read because
// it is probably out dated or no longer of interest, at which point it makes
// sense to remove it. So maybe I also want to check for unread entries that
// are very old and do something to them. From this perspective maybe it does
// make sense to use two flags (archiveState and readState) instead of one
// flag, because this way I can differentiate entries that were never read
// from those that were read once those entries are archived. Also, I still
// have some reservations about this, because I don't like the anxiety it
// causes me simply for not constantly reading. I don't want to feel like I
// just magically completely missed out on an important article. Another note,
// is that if I ever implement the history view, I have to be careful about
// what data I should retain.
// TODO: Do I need to also set readState? Perhaps that is implicit
// in archiveState? Moreover, if that is implicit, why am I
// using two separate flags instead of just one flag with 3 states?
// Using one flag would simplify the index keypath and store one less
// field in the entry store (both pre and post archive transform).
// I suppose I would also need to think about other things like count
// of unread and other areas that use the flag. Maybe I should just be
// using one flag.
// TODO: if I ever plan to implement a history view where I can see
// articles read, I should consider maintaining entry.title so that it
// can appear in the history view. Maybe I also want to add in a
// 'blurb' that is like truncateHTMLString that shows a bit of the full
// text of each entry.
function archiveEntries() {
  console.log('Archiving entries...');
  let processedEntryCount = 0, archivedEntryCount = 0;
  const EXPIRES_AFTER_MS = 10 * 24 * 60 * 60 * 1000;
  const currentDate = new Date();
  db.open(onConnect);

  function onConnect(event) {
    // Exit early if we failed to connect (e.g. blocked)
    if(event.type !== 'success') {
      console.debug(event);
      onComplete();
      return;
    }

    const connection = event.target.result;
    db.openReadUnarchivedEntryCursor(connection, handleCursor);
  }

  // Check if the entry at the current cursor position should be archived, and
  // if so, archive it, and then proceed to the next entry.

  function handleCursor(event) {
    const request = event.target;
    const cursor = request.result;

    if(!cursor) {
      onComplete();
      return;
    }

    processedEntryCount++;
    const entry = cursor.value;

    // Temporary support for legacy entry storage
    if(!entry.dateCreated && entry.created) {
      entry.dateCreated = new Date(entry.created);
    }

    let ageInMillis = 0;

    // If we do not know when the entry was created, then assume it is
    // archivable. Fake the age as whatever will always trigger the condition
    // to archive.
    if(!entry.dateCreated) {
      console.debug('Unknown entry date created, archiving');
      ageInMillis = EXPIRES_AFTER_MS + 1;
    } else {
      // NOTE: we know that both of these dates were created locally on the
      // client, so there is no risk that a server yields strange
      // dates. The only issue is when the client changes the system clock
      // in between archive runs.
      ageInMillis = getDateDifferenceInMilliseconds(currentDate,
        entry.dateCreated);
    }

    if(ageInMillis > EXPIRES_AFTER_MS) {
      const archivedEntry = getArchivableEntry(entry);
      cursor.update(archivedEntry);
      sendArchiveRequestedMessage(archivedEntry);
      archivedEntryCount++;
    }
    cursor.continue();
  }

  function onComplete() {
    console.log('Archived %s of %s entries', archivedEntryCount,
      processedEntryCount);
  }
}

function getDateDifferenceInMilliseconds(date1, date2) {
  return date1 - date2;
}

function getArchivableEntry(inputEntry) {
  const outputEntry = Object.create(null);
  outputEntry.id = inputEntry.id;
  outputEntry.feed = inputEntry.feed;
  outputEntry.urls = inputEntry.urls;

  if(inputEntry.dateRead) {
    outputEntry.dateRead = inputEntry.dateRead;
  }

  outputEntry.dateArchived = new Date();
  outputEntry.archiveState = db.EntryFlags.ARCHIVED;
  return outputEntry;
}

function sendArchiveRequestedMessage(entry) {
  const message = {
    'type': 'archiveEntryRequested',
    'entryId': entry.id
  };
  chrome.runtime.sendMessage(message);
}
