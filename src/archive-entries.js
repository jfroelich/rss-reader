// See license.md

'use strict';

const jrArchiveEntriesAlarmName = 'archive';
const jrArchiveEntriesMaxAge = 1 * 24 * 60 * 60 * 1000;// 1 day in ms

// Which props are retained when compacting
// TODO: just use a simple array because lookup speed not perf issue
const jrArchiveEntriesCompactedProps = {
  'dateCreated': undefined,
  'dateRead': undefined,
  'feed': undefined,
  'id': undefined,
  'readState': undefined,
  'urls': undefined
};

// Create an extension alarm for this background service
async function jrArchiveEntriesCreateAlarm(periodInMinutes) {
  const alarm = await jrUtilsGetAlarm(name);
  if(alarm)
    return;
  const options = {'periodInMinutes': periodInMinutes};
  chrome.alarms.create(jrArchiveEntriesAlarmName, options);
}

function jrArchiveEntriesRegisterAlarmListener() {
  chrome.alarms.onAlarm.addListener(jrArchiveEntriesOnAlarm);
}

async function jrArchiveEntriesOnAlarm(alarm) {
  // We have to bind to all alarm wakeups, so ignore other alarms
  if(alarm.name !== jrArchiveEntriesAlarmName)
    return;

  const db = new ReaderDb();
  const entryStore = new EntryStore();
  const archiver = new ArchiveEntriesr();
  const verbose = false;
  archiver.entryStore = entryStore;
  try {
    entryStore.conn = await db.jrDbConnect();
    await jrArchiveEntriesArchive(entryStore, verbose);
  } catch(error) {
    console.warn(error);
  } finally {
    if(entryStore.conn)
      entryStore.conn.close();
  }
}

function jrArchiveEntriesAssertValidMaxAge() {
  if(!Number.isInteger(jrArchiveEntriesMaxAge) || jrArchiveEntriesMaxAge < 0)
    throw new TypeError(`Invalid maxAge: ${jrArchiveEntriesMaxAge}`);
}

// TODO: max age should be a parameter, not a global constant. At least, if it
// is a global constant, it shouldn't be defined in this file
async function jrArchiveEntriesArchive(entryStore, verbose) {
  jrArchiveEntriesAssertValidMaxAge();
  if(verbose)
    console.log('Archiving entries older than %d ms', jrArchiveEntriesMaxAge);
  const entries = await entryStore.getUnarchivedRead();
  if(verbose)
    console.debug('Loaded %d entries', entries.length);
  const currentDate = new Date();
  const archivableEntries = jrArchiveEntriesGetEntriesToArchive(entries,
    currentDate);

  const compactedEntries = jrArchiveEntriesCompactEntries(archivableEntries,
    currentDate);
  if(verbose)
    jrArchiveEntriesLogSizeChanges(archivableEntries, compactedEntries);
  await entryStore.putAll(compactedEntries);
  jrArchiveEntriesDispatchArchiveEvent(compactedEntries);

  if(verbose)
    console.log('Archive entries completed (scanned %d, compacted %d)',
      entries.length, archivableEntries.length);
  return archivableEntries.length;
}

function jrArchiveEntriesGetEntriesToArchive(entries, currentDate) {
  const output = entries.filter((entry) =>
    currentDate - entry.dateCreated > jrArchiveEntriesMaxAge);
  return output;
}

// TODO: decouple from object filter, it's fancy for no reason
function jrArchiveEntriesCompactEntries(entries, archiveDate) {
  return entries.map((entry) => {
    const compacted = jrUtilsFilterObjectProperties(entry,
      jrArchiveEntriesIsCompactedProp.bind(this));
    compacted.archiveState = ENTRY_ARCHIVED;
    compacted.dateArchived = archiveDate;
    return compacted;
  });
}

function jrArchiveEntriesLogSizeChanges(expandedEntries, compactedEntries) {
  for(let i = 0, len = expandedEntries.length; i < len; i++) {
    const before = jrUtilsSizeOf(expandedEntries[i]);
    const after = jrUtilsSizeOf(compactedEntries[i]);
    console.debug(before, 'compacted to', after);
  }
}

function jrArchiveEntriesDispatchArchiveEvent(entries) {
  const ids = entries.map(jrArchiveEntriesGetEntryId);
  const chan = new BroadcastChannel('db');
  chan.postMessage({'type': 'archivedEntries', 'ids': ids})
  chan.close();
}

function jrArchiveEntriesGetEntryId(entry) {
  return entry.id;
}

function jrArchiveEntriesIsCompactedProp(obj, prop) {
  return prop in jrArchiveEntriesCompactedProps;
}
