
# About

Helpers for sanitizing the contents of an HTMLDocument

# TODO

* For some reason I am seeing log messages in console while poll is running that
indicate that scripts are failing to load due to a content security policy.
Perhaps the document created by fetch is not inert.
** I monitored removal of scripts, and scripts are certainly removed. Maybe
something is happening with parsing somewhere, maybe I am setting
document.innerHTML instead of doc.innerHTML or something like that.
* I think it is better to explicitly remove scripts in a separate function
rather than simply including it as a part of the blacklist filter. This will
also make it simpler to test the above issue exclusively, and narrow down where
there is a mistake in my assumptions.
** Note that I do not recall ever seeing these, so it has to do with something
that changes. New chrome version could have changed the fetch api internals.
Switching from xmlhttprequest to fetch may contribute. I could have introduced
a mistake somewhere when doing massive refactoring.
* Replace strong with b to shrink document size
* Replace em with i to shrink document size
* Replace entities with single unicode character where possible in order
to shrink document size?
* Fix things like <b><table></table></b>, see https://html.spec.whatwg.org/multipage/parsing.html mentions of adoption
algorithm and its errata notes

* filterAttributes needs cleanup, add helper functions
* For isSingleColumnRow, check if row.cells supports for..of
* For unwrapSingleColumnTable, check if table.rows supports for..of
* For unwrapSingleColumnTable, only pad if adjacent to text
