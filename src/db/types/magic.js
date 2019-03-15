// The magic module presents a unified list of hidden magic fields used by
// various entities in the model layer. It is preferable to define magic values
// here, in a single file, because one of the key properties of magic values is
// that each magic value is distinct from the other. Using a single module helps
// ensure that property.

// Using magic values provides a weak form of type safety. Due to how indexedDB
// works, it is not possible to easily deserialize plain object data back into
// its corresponding type(s). By storing a magic value, it is easy to check if
// the magic value loaded from the database corresponds to the expected type.

export const ENTRY_MAGIC = 0xdeadbeef;
export const FEED_MAGIC = 0xfeedfeed;
