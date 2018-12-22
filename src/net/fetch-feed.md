# fetch-feed
Fetches a remote feed xml file. Note that this is not a generic library, this applies app-specific behavior. To get generic functionality, directly interact with the components that compose this function.

This function is a composition of the following functions:
* Fetching the contents of the remote file
* Parsing the contents into a generic parsed-feed object
* Coercing the generic format into the app's stored-feed format

TODOs
* conflict on whether this is fetch-xml + parse-xml + coerce-feed, or something like a specialization wrapper of fetch-xml. it is a composition, for sure. one problem with composition is the sheer amount of errors a single call can generate. but at the same time, not composing is really just shifting separate error handling into the calling client, because it is not like the number of errors decreases in the calling context.
* test should be run on a local resource
* test cannot accept parameters
