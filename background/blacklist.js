// Simple blacklist object
(function(exports){
'use strict';

function Blacklist() {
    
  // Store raw pattern texts in a backing array
  this.patterns;
}

// Returns true if the str matches any of the patterns
Blacklist.prototype.isBlacklisted = function(str) {
    // Right now, no return, so return undefined, so 
    // always false (nothing is blacklisted)
};

// Set the internal patterns array to the given array
Blacklist.prototype.setPatterns = function(arr) {
    this.patterns = arr;
};

// Get the internal patterns array
Blacklist.prototype.getPatterns = function() {
  return this.patterns || [];  
};

// Initializes the internal patterns list from local storage
Blacklist.prototype.load = function() {
    var str = localStorage.BLACKLIST_PATTERNS;
    if(str) {
        var obj = JSON.parse(str);
        this.patterns = obj.patterns || [];
    } else {
        this.patterns = [];
    }
};

// Saves the internal patterns list to local storage
Blacklist.prototype.save = function() {
    var patterns = this.patterns;
    localStorage.BLACKLIST_PATTERNS = 
        JSON.stringify({'patterns': patterns || []});
};

exports.Blacklist = Blacklist;
    
})(this);