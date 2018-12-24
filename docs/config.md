# config
This module abstracts away configuration storage and provides an interface to reading and writing configuration values. This module does not concern itself with initializing or updating configuration in relation to extension lifecycle events.

Although this is a thin wrapper around local storage, no assumptions should be made about how to interact with config's chosen method of persistence. it may change.

## TODOS
* consider revert to using only write_property, read_property functions, and remove all the type specific functions
