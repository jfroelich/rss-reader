'use strict';

// Global exceptions

class ParseError extends Error {
  constructor(message) {
    super(message || 'Parse error');
  }
}
