// Global app status codes

'use strict';

// Represents a successful operation
const STATUS_OK = 0;

// TODO: merge db state and op
const ERR_DB_STATE = -2;
const ERR_DB_OP = -3;
const ERR_FETCH = -4;
const ERR_PARSE = -5;

// Represents some error related to invalid/unexpected HTML/XML DOM state or
// failed dom operation
const ERR_DOM = -6;
