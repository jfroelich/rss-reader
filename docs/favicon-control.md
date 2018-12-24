# favicon-control
This is a higher layer wrapper module around the base favicon-service module. All other functionality that need favicon functionality in this extension should operate through this wrapper, and should not directly interact with favicon-service. This way I only need to change one module if the favicon functionality changes.
