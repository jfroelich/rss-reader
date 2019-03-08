import {assert} from '/src/assert.js';

// A deadline represents the latest time by which something should be completed,
// such as a timeout value. A deadline can also represent an initial delay
// before starting something.
export class Deadline {
  // |value| should be a positive integer representing an amount of time in
  // milliseconds units
  constructor(value) {
    assert(Number.isInteger(value));
    assert(value >= 0);

    this.value = value;
  }

  isDefinite() {
    return this.value > 0;
  }

  toInt() {
    return this.value;
  }

  toString() {
    return '' + this.value;
  }
}

export const INDEFINITE = new Deadline(0);
