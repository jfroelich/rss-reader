import {is_entry, is_valid_entry_id} from '/src/entry.js';
import {log} from '/src/log.js';

// TODO: decouple from log.js

// TODO: implement. Check required properties? This function is specifically
// validation for storage, so maybe I should have constraints like the urls list
// must have at least one entry. In addition, for each entry property, ensure it
// is either undefined/null or the proper type. In addition, maybe ensure dates
// are not in the future contain NaN or things like that.

// TODO: the problem now is that I have no idea of what causes invalidity
// outside of logging something. I need to distinguish between the reasons
// something is invalid. Maybe return a code, 0 being valid, -1 being invalid
// reason #1, -2 being invalid reason #2, etc. Or maybe implement as a void
// function that throws exceptions, even though these are not programming errors

// TODO: Validation shouldn't throw an exception. Data is routinely bad. Bad
// data is not a program error. Exceptions should be reserved for programming
// errors. But what else is there to do in this case? And which module or step
// in the entry-processing-pileine is responsible for ensuring the input data is
// ever good? How do I differentiate between code earlier in the execution path
// being poorly written, and bad data?

// TODO: validate more properties

// TODO: validate that there are no unexpected properties (expandos) that snuck
// into the property list. This means the entire schema must be known apriori,
// and defined/accessible here, and that this increases rigidity substantially.
// So much that maybe I want some kind of schema-oriented organization to align
// better with SRP.

// TODO: maybe move is_valid_entry_id definition to here? This would also make
// it easier if I add per-property validation functions.

// Returns whether an entry is valid
// NOTE: only partially implemented
export function validate_entry(entry) {
  if (!is_entry(entry)) {
    return false;
  }

  // This could be called on a new entry that does not have an id, so only
  // check id validity when the property exists
  if ('id' in entry) {
    if (!is_valid_entry_id(entry.id)) {
      log('%s: invalid id', validate_entry.name, entry.id);
      return false;
    }
  }

  return true;
}
