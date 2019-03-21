// Using magic values provides a weak form of type safety. Due to how indexedDB
// works, it is not possible to easily deserialize plain object data back into
// its corresponding type(s). By storing a magic value, it is easy to check if
// the magic value loaded from the database corresponds to the expected type.

export const ENTRY_MAGIC = 0xdeadbeef;
export const FEED_MAGIC = 0xfeedfeed;


export function is_entry(value) {
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}
