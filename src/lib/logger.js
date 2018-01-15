/**
 * Simple logging facility
 */

let logLevel = 2;

(function initModule() {
  switch (process.env["LOG_LEVEL"]) {
    case "debug": 
      logLevel = 2;
      break;
    case "info": 
      logLevel = 1;
      break;
    case "error": 
      logLevel = 0;
      break;
  }
})();

module.exports = {
  debug() {
    if (logLevel > 1) console.log(...arguments);
  },
  log() {
    if (logLevel > 0) console.log(...arguments);
  },
  error() {
    console.log("ERROR:", ...arguments);
  },
};