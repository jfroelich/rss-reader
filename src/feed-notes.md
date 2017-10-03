
# TODO

* An entry should probably only have one url. Instead I should probably
be storing something external pertaining to polling requests or a list of
urls of some sort.
* Consider revising entry flags to be a single property. Instead of two entry
properties, readState and archiveState, consider a single property. For example, UNREAD_UNARCHIVED. This would speed up querying of entries by both states.
Admittedly this is not currently a performance concern. Performance really isn't
the reason. The focus should be on ergonomics.

# Validation todo

NOTE: only validating date objects, not fully validating actual dates such
as if day of month > 31 or whatever
TODO: assert required properties are present
TODO: assert dates are not in the future
TODO: assert dates are not too far in the past
TODO: assert type, if set, is one of the valid types
TODO: assert feed has one or more urls
TODO: assert the type of each property?
TODO: add to appropriate calling contexts (e.g. whereever prep for storage
