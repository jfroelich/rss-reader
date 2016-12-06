// See license.md

'use strict';

class EntryArchiver {
  constructor() {
    this.maxAge = 1 * 24 * 60 * 60 * 1000;// 1 day in ms
    this.verbose = false;
    this.entryStore = null;

    // Which props are retained when compacting
    this.compactedProps = {
      'dateCreated': undefined,
      'dateRead': undefined,
      'feed': undefined,
      'id': undefined,
      'readState': undefined,
      'urls': undefined
    };
  }

  // Create an extension alarm for this background service
  static async createAlarm(periodInMinutes) {
    const name = EntryArchiver.alarmName;
    const alarm = await ExtensionUtils.getAlarm(name);

    // Do nothing if the alarm already exists
    if(alarm)
      return;
    console.debug('Creating alarm', name);
    const options = {'periodInMinutes': periodInMinutes};
    chrome.alarms.create(name, options);
  }

  static registerAlarmListener() {
    chrome.alarms.onAlarm.addListener(EntryArchiver.onAlarm);
  }

  static async onAlarm(alarm) {
    // Ignore other alarm wakeups
    if(alarm.name !== EntryArchiver.alarmName)
      return;

    const db = new ReaderDb();
    const entryStore = new EntryStore();
    const archiver = new EntryArchiver();
    archiver.entryStore = entryStore;
    try {
      entryStore.conn = await db.connect();
      await archiver.archive();
    } catch(error) {
      console.warn(error);
    } finally {
      if(entryStore.conn)
        entryStore.conn.close();
    }
  }

  assertValidMaxAge() {
    if(!Number.isInteger(this.maxAge) || this.maxAge < 0)
      throw new TypeError(`Invalid maxAge: ${this.maxAge}`);
  }

  async archive() {
    this.assertValidMaxAge();
    if(this.verbose)
      console.log('Archiving entries older than %d ms', this.maxAge);
    const entries = await this.entryStore.getUnarchivedRead();
    if(this.verbose)
      console.debug('Loaded %d entries', entries.length);
    const currentDate = new Date();
    const archivableEntries = this.getEntriesToArchive(entries,
      currentDate);
    const compactedEntries = this.compactEntries(archivableEntries,
      currentDate);
    this.logSizeChanges(archivableEntries, compactedEntries);
    await this.entryStore.putAll(compactedEntries);
    this.dispatchArchiveEvent(compactedEntries);

    if(this.verbose)
      console.log('Archive entries completed (scanned %d, compacted %d)',
        entries.length, archivableEntries.length);
    return archivableEntries.length;
  }

  getEntriesToArchive(entries, currentDate) {
    const output = entries.filter((entry) =>
      currentDate - entry.dateCreated > this.maxAge);
    console.debug('Archivable entry count is', output.length);
    return output;
  }

  compactEntries(entries, archiveDate) {
    return entries.map((entry) => {
      const compacted = ObjectUtils.filter(entry,
        this.isCompactedProp.bind(this));
      compacted.archiveState = Entry.ARCHIVED;
      compacted.dateArchived = archiveDate;
      return compacted;
    });
  }

  logSizeChanges(expandedEntries, compactedEntries) {
    if(!this.verbose)
      return;

    for(let i = 0, len = expandedEntries.length; i < len; i++) {
      const before = ObjectUtils.sizeof(expandedEntries[i]);
      const after = ObjectUtils.sizeof(compactedEntries[i]);
      console.debug(before, 'compacted to', after);
    }
  }

  dispatchArchiveEvent(entries) {
    const ids = entries.map(this.getId);
    const chan = new BroadcastChannel('db');
    chan.postMessage({'type': 'archivedEntries', 'ids': ids})
    chan.close();
  }

  getId(entry) {
    return entry.id;
  }

  isCompactedProp(obj, prop) {
    return prop in this.compactedProps;
  }
}

EntryArchiver.alarmName = 'archive';
