The entry module provides functions for working with application entry objects.

### About `entry_sanitize`

Returns a new entry object where fields have been sanitized. Impure. Note that this assumes the entry is valid. As in, passing the entry to entry_is_valid before calling this function would return true. This does not revalidate. Sanitization is not validation. Here, sanitization acts more like a normalizing procedure, where certain properties are modified into a more preferable canonical form. A property can be perfectly valid, but nevertheless have some undesirable traits. For example, a string is required, but validation places no maximum length constraint on it, just requiredness, but sanitization also places a max length constraint on it and does the necessary changes to bring the entry into compliance via truncation.

### TODOs

* I feel like this should eventually be renamed, entry is too abstract of a name
* in entry_sanitize, now that filter_unprintable_characters exists, I want to also filter such characters from input strings like author/title/etc. However it overlaps with the call to string.filter_control_characters here. There is some redundant work going on. Also, in a sense, string.filter_control_characters is now inaccurate. What I want is one function that strips binary characters except important ones, and then a second function that replaces or removes certain important binary characters (e.g. remove line breaks from author string). Something like 'string_replace_formatting_characters'.
