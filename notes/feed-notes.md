
# TODO

* An entry should probably only have one url. Instead I should probably
be storing something external pertaining to polling requests or a list of
urls of some sort.
* Consider revising entry flags to be a single property. Instead of two entry
properties, readState and archiveState, consider a single property. For example, UNREAD_UNARCHIVED. This would speed up querying of entries by both states.
Admittedly this is not currently a performance concern. Performance really isn't
the reason. The focus should be on ergonomics.
