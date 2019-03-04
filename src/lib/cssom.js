// TODO: this is a placeholder module, brainstorming

// Encapsulate all the icky details of getting and setting css values here,
// and change all other modules to interact with css through this module instead
// of direct interaction. This will simplify tasks like making things
// cross-browser if that is ever needed.

// Issue: but what about modules that rely on using first class values like
// CSSUnitValue? The abstraction breaks unless all the other modules work as
// before on typical cross browser primitives. I would have to completely
// encapsulate the use of CSSUnitValue here, inside this module only, and the
// API would accept and produce only normal primitives. Perhaps what I could do
// is define a custom type here that is highly compatible with CSSUnitValue.
// Then the other modules tightly couple to the custom type instead. Then param
// and return types with the custom type, and internally, do simple conversion
// to CSSUnitValue?
