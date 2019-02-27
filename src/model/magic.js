// The magic module presents a unified list of hidden magic fields used by
// various entities in the model layer. It is preferable to define magic values
// here, in a single file, because one of the key properties of magic values is
// that each magic value is distinct from the other. Using a single module helps
// ensure that property.

// These values cannot be stored in the model module itself, because there may
// be multiple modules that require access to magic values but do not rely on
// functionality in model.js.

// Using magic values provides a weak form of type safety. Due to how indexedDB
// works, it is not possible to easily deserialize plain object data back into
// its corresponding type(s). By storing a magic value, it is easy to check if
// the magic value loaded from the database corresponds to the expected type.

// TODO: I am now more comfortable with incurring deserialization cost and
// performing explicit deserialization at the model layer. I have also
// introduced, long after beginning to use magic, explicit entity classes like
// Entry and Feed. Therefore, there is less of a need to use magic. Instead, I
// can use simple instanceof type checks in the various sanity checks.
// Therefore, I think I would like to eventually deprecate the use of magic
// fields.

export const ENTRY_MAGIC = 0xdeadbeef;
export const FEED_MAGIC = 0xfeedfeed;
