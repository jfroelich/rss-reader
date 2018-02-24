
The background page is loaded exclusively by background.html.

The background.html page is configured as a dynamic page in manifest.json, meaning that it will periodically be loaded and then unloaded as needed. In other words it is not persistently live for the lifetime of the browser.

The background page is concerned with the following:
* Extension installation
* Exporting a CLI interface to the browser's console
* Registering alarms, and handling alarm wakeup events

# TODO consider thinning functionality
This is doing somethings that should be in a layer below the view. Move things into that other layer. This should be a dumber view, like a thin-client.

# TODO: consider splitting up functionality again

Make cli.js, alarms.js, as sub-modules specific to the background page. Right now things are mixed together. I am conflicted about the best way to organize things.

# TODO: consider sharing functionality between alarms and cli

Both libs do roughly the same thing. Currently there is some redundancy and real similarity between the bodies of the functions in each lib.

Maybe have a layer called background-tasks that provides functions that carry out a task. Then have both the cli and alarm wakeup handlers just call out to this helper module.

# TODO: consider using ral.js

The background page is a view, just like the slideshow and options page. Rather than deal with connecting to the databases, consider defining helper functions in ral.js and just calling those functions.
