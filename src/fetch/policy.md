### notes and todos

* Allow various overrides through localStorage setting or some config setting?
* Of course things like hosts file can be manipulated to whatever. This is just one of the low-hanging fruits. Prevent fetches to local host urls.
* When checking against localhost values, again, ignores things like punycode, IPv6, host manipulation, local dns manipulation, etc. This is just a simple and typical case
* When checking for username/pass, prevent fetches of urls containing credentials. Although fetch implicitly throws in this case, I prefer to explicit. Also, this is a public function in use by other modules that may not call fetch (e.g. see fetch_image_element) where I want the same policy to apply.
