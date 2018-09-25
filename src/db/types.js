// This module provides type help. Objects stored in indexedDB undergo a clone
// operation that strips function objects of type, making it impossible to use
// instanceof to reliably verify an object's type after it has been loaded. As a
// workaround, objects stored in the database are each assigned an extra magic
// property that encodes type information within the object. Then, instead of
// using instanceof, users can test for the presence of this psuedo-hidden
// property and its value to provide a weak type guarantee. This is particularly
// useful when using in combination with assertions to validate against the
// parameters to functions that work with data objects, or to ensure that data
// stored in the database, once read, was properly stored. Basically this is
// hacky type safety.

// Cost-benefit analysis: The cost is the added storage space of having an extra
// property for each object. The benefit is a form of type safety that allows
// for assertion based programming. I made the design decision that the benefit
// outweighs the cost.

// The values here are meaningless. The only significance of these values is
// that each value should be different. These values are extremely unlikely to
// change. Changing any one value will require a tedious database version
// migration script, and an increase in the database version.

export const ENTRY_MAGIC = 0xdeadbeef;
export const FEED_MAGIC = 0xfeedfeed;

// The test against the truthiness of value before the others is the fast check
// against null, because typeof null is 'object'.

export function is_entry(value) {
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}
