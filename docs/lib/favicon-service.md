# favicon-service
Provides a way to get the favicon image url for a page url

### TODOs
* Once url-loader is a library in the lib folder, this should also become a lib, and maybe I should make lookup-icon operation (and ops like compact-favicons) too, only interact with the favicon-service lib through those operations instead of directly in other parts of the app. Because url-loader is not currently a lib, and my general rule is that libs cannot depend on app components (only other lib components), this has to wait.

### Test todos:
* actually run tests instead of command line
* test offline
* test a non-existent host
* test a known host with origin /favicon.ico
* test a known host with <link> favicon
* test a non-expired cached input url
* test a non-expired cached redirect url
* test a non-expired cached origin url
* same as above 3 but expired
* test against icon with byte size out of bounds
* test cacheless versus caching?
* test compact
* reintroduce dependency on html-parser
