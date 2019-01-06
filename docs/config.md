# config-control


## TODOs
* turns out adding a font is difficult, this needs to be changed so that I can add a font and it gets stored in config
* regarding update_config, updates get fired for many reasons, such as when reloading the extension from the extensions page. This does not indicate a version change. Removing legacy keys should be based on extension version change. I always forget what this is, and might use it in the future: `const previous_version_string = event.previousVersion;`


# config
This module abstracts away configuration storage and provides an interface to reading and writing configuration values. This module does not concern itself with initializing or updating configuration in relation to extension lifecycle events.

Although this is a thin wrapper around local storage, no assumptions should be made about how to interact with config's chosen method of persistence. it may change.

## TODOS
* consider revert to using only write_property, read_property functions, and remove all the type specific functions
