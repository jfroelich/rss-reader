The `create_feed` function creates a new feed in storage

### TODOS
 * documentation
 * relocate helpers and deprecrate rdb, move functions that are only in use
here as private helpers here, part of giving up on storage layer and instead
focusing on high-coherency operations layer, look at zircon syscalls api and
implementation as api-design reference example
* testing that focuses exclusively on create_feed
* the prep stuff and validation stuff should probably be isolated somewhere
and not specific to rdb, somewhere under app, maybe as part of an objects
folder, as helper to feed objects
* consider being redundant and not delegating to update_feed
* channel post stuff should probably be abstracted away a bit eventually
* probably should inline assert, deprecate helper
