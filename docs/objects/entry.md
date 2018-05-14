# entry
The entry module provides functions for working with application entry objects.

### `append_entry_url` notes
Append a url to an entry's url list. Lazily creates the urls property if needed. Normalizes the url. The normalized url is compared against existing urls to ensure the new url is unique. Returns true if entry was added, or false if the url already exists and was therefore not added.

### About `db_sanitize_entry`
Returns a new entry object where fields have been sanitized. Impure. Note that this assumes the entry is valid. As in, passing the entry to is_valid_entry before calling this function would return true. This does not revalidate. Sanitization is not validation. Here, sanitization acts more like a normalizing procedure, where certain properties are modified into a more preferable canonical form. A property can be perfectly valid, but nevertheless have some undesirable traits. For example, a string is required, but validation places no maximum length constraint on it, just required-ness, but sanitization also places a max length constraint on it and does the necessary changes to bring the entry into compliance via truncation.

Internal implementation note:  Create a shallow clone of the entry. This is partly the source of impurity. Here shallow refers to the fact that several of the properties are objects where the reference to the object is copied, instead of copying the entire value as a new object. Which basically means the new properties point to the old properties. Which basically means to be careful about doing things like modifying the urls property of the input entry after the sanitize call, because it will implicitly cause spooky-action-at-a-distance and modify the output entry object too. I've chosen the shallow copy because it is generally faster and I assume I can always be careful

### TODOs
* I feel like this should eventually be renamed, entry is too abstract of a name
* in db_sanitize_entry, now that filter_unprintable_characters exists, I want to also filter such characters from input strings like author/title/etc. However it overlaps with the call to string.filter_control_characters here. There is some redundant work going on. Also, in a sense, string.filter_control_characters is now inaccurate. What I want is one function that strips binary characters except important ones, and then a second function that replaces or removes certain important binary characters (e.g. remove line breaks from author string). Something like 'string_replace_formatting_characters'.
* Implement `db_validate_entry`. Check required properties? This function is specifically validation for storage, so maybe I should have constraints like the urls list must have at least one entry. In addition, for each entry property, ensure it is either undefined/null or the proper type. In addition, maybe ensure dates are not in the future contain NaN or things like that.
