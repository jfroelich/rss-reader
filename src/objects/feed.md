### is_feed notes
// Return true if the value looks like a feed object

// While it perenially appears like the value condition is implied in the
// typeof condition, this is not true. The value condition is short for value
// !== null, because typeof null === 'object', and not checking value
// definedness would cause value.magic to throw. The value condition is
// checked first, because presumably it is cheaper than the typeof check.

// indexedDB does not support storing Function objects, because Function
// objects are not serializable (aka structured-cloneable), so we store basic
// objects. Therefore, because instanceof is out of the question, and typeof
// cannot get us any additional type guarantee beyond stating the value is
// some object, we use a hidden property called magic to further guarantee the
// type.
