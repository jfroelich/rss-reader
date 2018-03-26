
# filter_unprintable_characters notes
* \t \u0009 9, \n \u000a 10, \f \u000c 12, \r \u000d 13
* The regex matches 0-8, 11, and 14-31
* I assume v8 will hoist regex if this is hot, so I am defining the constant within the function
* I assume v8 handles + and /g redundancy intelligently
* The length check is done because given that replace will be a no-op when the length is 0 it is faster to perform the length check than it is to call replace. I do not know the distribution of inputs but I expect that empty strings are not rare.

# filter_unprintable_characters todos

// TODO: look into how much this overlaps with filter_control_characters
// TODO: review why I decided to allow form-feed? I'm not sure why.
// If the input is a string then this returns a new string that is a copy of the
// input less certain 'unprintable' characters. A character is unprintable if
// its character code falls within the range of [0..31] except for tab, new
// line, carriage return and form feed. In the case of bad input the input
// itself is returned. To test if characters were replaced, check if the output
// string length is less than the input string length.

# filter_control_characters notes

// Returns a new string where Unicode Cc-class characters have been removed.
// Throws an error if string is not a defined string. Adapted from these stack
// overflow questions:
// http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262

### Notes on is_alphanumeric

The function returns whether the string is alphanumeric. Counter-intuitively, this works by testing for the presence of any non-alphanumeric character. The empty string is true, null/undefined are true. Does NOT support languages other than English

* See https://stackoverflow.com/questions/4434076
* See https://stackoverflow.com/questions/336210
