
# TODO

* Revisit idea of just naming this something like feedparser

# TODO: Uniformly handle text node content when parsing

There is a strange issue with cdata nodes or something when parsing atom feeds.
I don't quite understand it.

This is a bug I have currently fixed with a hackish thing. I'd prefer to find
the root cause of the problem. I think it is CDATA related.

Note this isn't actually a bug. The code works. It is just that I have to do
strange processing of the content, and I want to understand why, and I would
rather approach content handling uniformly

# Misc parse feed notes (copied from old github issue)

add helper for entry enclosure instead of how it is inlined

setup testing

** walking children seems to be slower than querySelector, revert to using it,
but think of a way to maintain strictness

# Improve entity handling

I am occasionally seeing an error like the following in the console:

Error: This page contains the following errors:error on line 803 at column 54:
Entity 'mdash' not defined ...

It may be because I am allowing for the html mime type for xml, then trying to
parse the html as xml, and this is the cause of the error. If that is the case
I suppose I could try a few alternatives. I could parse feeds as html. I could
disallow the html mime type. I could switch between parsing as html or xml
depending on the server's response type.

Or, I could preprocess the text and try to fix entities. For example, see https://stackoverflow.com/questions/5972143 . The second answer provides that
"HTML entity names are not valid in XML without defining them with
<!ENTITY name ...>. But numeric entities will do the trick." This means I could
run through all the named entities and convert them into numeric entities.
