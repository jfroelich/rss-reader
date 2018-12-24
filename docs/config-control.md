# config-control


## TODOs
* turns out adding a font is difficult, this needs to be changed so that I can add a font and it gets stored in config
* regarding update_config, updates get fired for many reasons, such as when reloading the extension from the extensions page. This does not indicate a version change. Removing legacy keys should be based on extension version change. I always forget what this is, and might use it in the future: `const previous_version_string = event.previousVersion;`
