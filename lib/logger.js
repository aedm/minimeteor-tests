let logLevel = 2;

const Logger = {
  debug() {
    if (logLevel < 2) return;
    console.log(...arguments);
  },
  log() {
    if (logLevel < 1) return;
    console.log(...arguments);
  },
  error() {
    console.log("ERROR:", ...arguments);
  },
};

(function() {
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
  Logger.debug("Starting:", process.argv.join(" "));
})();

module.exports = Logger;