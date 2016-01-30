// Messing around with an idea of async logging
const Logger = {};

Logger.logAsync = function() {
  setTimeout(Logger.log.bind(null, arguments), 0);
};

Logger.log = function() {
  console.log(arguments);
};
