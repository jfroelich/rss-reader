'use strict';

// Global error codes

// Represents non-error status
const RDR_OK = 0;

// Database related error
const RDR_ERR_DB = -1;

// HTTP fetch related error
const RDR_ERR_FETCH = -2;

// Parsing error
const RDR_ERR_PARSE = -3;

// DOM related error
const RDR_ERR_DOM = -4;

// TypeError
const RDR_EINVAL = -5;

// Constraint error (e.g. duplicate db key)
const RDR_ERR_CONSTRAINT = -6;


// Global exceptions

class ParseError extends Error {
  constructor(message) {
    super(message || 'Parse error');
    //Error.captureStackTrace(this, this.constructor.name);
  }
}
