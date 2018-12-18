export default class ExtensionLock {
  // Initializes the lock, but does not acquire it. The caller should use a name
  // that is unique to this lock and the other instances that share the lock.
  // The value is optional and just helpful for debugging who obtained the lock.
  constructor(name, value = 'unknown') {
    this.name = name;
    this.value = value;
    this.did_auto_unlock = false;
    this.release_timer = undefined;
  }

  // Obtains the actual lock. Currently this is naive and does nothing to check
  // if already acquired.
  // @param unlock_deadline {Number} optional, if specified then this schedules
  // the lock to be released after the specified number of milliseconds, this is
  // a helpful paranoid step for ensuring locks get cleaned up if not using
  // try/finally or concerned about errors and to avoid the dreaded permalock
  acquire(unlock_deadline) {
    localStorage[this.name] = this.value;

    if (unlock_deadline) {
      this.release_timer =
          setTimeout(this._timedRelease.bind(this), unlock_deadline);
    }
  }

  // Returns whether there is a lock acquired
  isLocked() {
    // We don't care about value, just key presence
    const value = localStorage[this.name];
    return typeof value !== 'undefined';
  }

  // Free the lock name
  release() {
    // Discard the release timer. Might be a noop, do not care.
    clearTimeout(this.release_timer);
    delete localStorage[this.name];
  }

  // @private
  // Called once deadline is reached in acquire step to auto-unlock
  _timedRelease() {
    console.warn('Releasing lock abnormally, lock value was %s', this.value);
    this.did_auto_unlock = true;
    this.release();
  }
}
