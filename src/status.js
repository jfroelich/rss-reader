
const STATUS = {
  // Normal status
  'OK': 0,

  // TODO: should have a general DB error class, no need for separate
  // errors. E.g. delete DB_OP, rename DB_STATE to DB

  // The database was not in the expected state
  'ERR_DB_STATE': -2,
  // A database operation failed for some reason
  'ERR_DB_OP': -3
};
