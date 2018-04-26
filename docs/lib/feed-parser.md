# feed-parser
The `parse` function accepts a string as input. The string should be the full text of an xml file. The xml is parsed into a Document object, and then the Document object is coerced into a basic JavaScript object. Feed properties are stored in the parsed object. The output object contains an entries property that is an array of entry objects, where each entry represents one of the xml items (or entries).

// Parses the input string into a feed object. The feed object will always have
// a defined entries array, although it may be zero length. Returns a feed
// object or throws

### Params
* value {String} the xml string to parse
* skip_entries {Boolean} if true, entries are not processed, and an empty entries array is included in the result
* resolve_entry_urls {Boolean} if true, entry urls are canonicalized using feed.link as the base url

### get-local-name notes
One of the counter-intuitive things about the Document object is that it secretly holds a flag for whether the document is xml or html. Certain Document method behavior changes based on this private flag. The flag is not exposed.

One of the behaviors that changes is how node names are produced. In xml-flagged documents, element.localName is case-sensitive. This function exists so that it can normalize the name to lowercase.

I've chosen lowercase arbitrarily over uppercase. I simply need a canonical form for element names.

This function largely exists to expose this subtlety in a very clear manner, to highlight how fundamental this knowledge is to properly processing parsed xml. It is quite unfortunate that it is not clear on its face from the documentation. It is also surprising that behavior changes based on a private flag. So this is trying to abstract away the surprise by making the non-simple logic very clear. There is a required overhead to get the name of an element. I think of this as a design flaw.

This uses local name to avoid dealing with qualified names.

### find_entry_content note
So I think I handle cdata content correctly, but note the issue with title still having raw entities. Or, rather, should content be not encoded in any situation?

### feed_resolve_entry_urls todos
* If a feed has a link, and the link is invalid, should that actually be considered a parse error? In other words, this should not catch this error here?
* If failing to resolve an entry, should this set entry.link to undefined or remove the property, or leave it as is like now?

### TODOS
* not sure if this is best place to set fetch policy
* when finding feed type, use element_get_local_name?
* Write specific tests that test various assertions, e.g. preconditions, postconditions, and make it automatic
