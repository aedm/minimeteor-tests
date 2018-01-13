"use strict";

const fs = require('fs');
const child_process = require('child_process');
const escape = require('escape-html');
const execSync = require('child_process').execSync;
const Config = require("./config.js");
const Logger = require("./logger.js");

const MeteorBuildQueueFile = `${Config.TASK_QUEUE_DIR}/${Config.METEOR_BUILD_QUEUE_FILE}`;
const AlpineBuildQueueFile = `${Config.TASK_QUEUE_DIR}/${Config.ALPINE_BUILD_QUEUE_FILE}`;

const isWindows = /^win/.test(process.platform);

(function () {
  if (!fs.existsSync(Config.TASK_QUEUE_DIR)) {
    Logger.log(`Directory "${Config.TASK_QUEUE_DIR}" doesn't exist, creating...`)
    fs.mkdirSync(Config.TASK_QUEUE_DIR);
  }
  try {
    fs.accessSync(Config.TASK_QUEUE_DIR, fs.W_OK);
  } catch (ex) {
    Logger.error(ex.toString());
    Logger.error(`Cannot write into directory "${Config.TASK_QUEUE_DIR}"`);
    process.exit(1);
  }
})();


/**
 Adds a command to the Linux task spooler. Uses "tsp".
 */
function enqueueCommand(command) {
  if (isWindows) {
    Logger.log(`Can't queue task under Windows: ${command}`);
    return;
  }
  Logger.log("Enqueueing command: ", command);
  let batchCommand = `tsp -n bash -c "${command} 2>&1 | logger --tag minimeteor"`;
  try {
    execSync(batchCommand, {stdio: "inherit"})
  } catch (ex) {
    Logger.error(ex.toString());
  }
}

function tryExec(command) {
  Logger.debug("------------------");
  Logger.log("Executing:", command);
  try {
    execSync(command, {stdio: "inherit"});
    return true;
  } catch (ex) {
    Logger.error(ex.toString());
    return false;
  }
}

function exec(command) {
  Logger.debug("------------------");
  Logger.log("Executing:", command);
  execSync(command, {stdio: "inherit"});
}

function retExec(command) {
  Logger.debug("------------------");
  Logger.log("Executing:", command);
  let retVal = execSync(command).toString().trim();
  Logger.debug("Command returned:", retVal);
  return retVal;
}

function writeQueueFile(file, tags) {
  fs.writeFileSync(file, tags.join("\n") + "\n");
}

function enqueueBuild(file, tag) {
  let lines = getQueueFile(file);
  if (!lines.find(line => line === tag)) {
    lines.push(tag);
    writeQueueFile(file, lines);
  }
}

function spoolMeteorBuilder() {
  let command = `${Config.NODE_CMD} ${__dirname}/../meteorbuilder.js`;
  enqueueCommand(command);
}

function spoolAlpineBuilder() {
  let command = `${Config.NODE_CMD} ${__dirname}/../alpinebuilder.js`;
  enqueueCommand(command);
}


function getQueueFile(file) {
  // If the file doesn't exist, that's ok.
  if (!fs.existsSync(file)) return [];

  let fileContent = fs.readFileSync(file).toString();
  return fileContent.split(/[\r\n]+/g).filter(line => line !== "");
}

/**
 Returns the currently enqueued Meteor build tags
 */
function getMeteorQueue() {
  return getQueueFile(MeteorBuildQueueFile);
}

/**
 Returns the currently enqueued Alpine build tags
 */
function getAlpineQueue() {
  return getQueueFile(AlpineBuildQueueFile);
}

/**
 * Set Meteor build queue
 */
function setMeteorQueue(tags) {
  writeQueueFile(MeteorBuildQueueFile, tags);
  if (tags.length) spoolMeteorBuilder();
}

/**
 * Set Alpine build queue
 */
function setAlpineQueue(tags) {
  writeQueueFile(AlpineBuildQueueFile, tags);
  if (tags.length) spoolAlpineBuilder();
}

/**
 Adds a Meteor tag to the build queue.
 */
function enqueueMeteorTag(tag) {
  Logger.log("Enqueueing Meteor version:", tag);
  enqueueBuild(MeteorBuildQueueFile, tag);
  spoolMeteorBuilder();
}

/**
 Adds an Alpine tag to the build queue.
 */
function enqueueAlpineTag(tag) {
  Logger.log("Enqueueing Node.js version:", tag);
  enqueueBuild(AlpineBuildQueueFile, tag);
  spoolAlpineBuilder();
}

/**
 * Dequeue a file based on a list of already built Docker images.
 * @returns string tag to build next
 */
function dequeueBuildTag(file, builtTags, leaveInQueue) {
  let tags = getQueueFile(file);

  let tag = null;
  while (tags.length > 0) {
    tag = tags.shift();
    if (!builtTags.find(x => x === tag)) {
      if (leaveInQueue) {
        // Put it back on the end of the list, in case the build fails.
        tags.push(tag);
      }
      break;
    }
    tag = null;
  }
  writeQueueFile(file, tags);
  return tag;
}

/**
 * Dequeues Meteor build list.
 * @param builtTags  Already built images on Docker Hub
 * @returns string  Tag to build next
 */
function deqeueMeteorTag(builtTags) {
  return dequeueBuildTag(MeteorBuildQueueFile, builtTags, false);
}

/**
 * Dequeues Alpine build list.
 * @param builtTags  Already built images on Docker Hub
 * @returns string  Tag to build next
 */
function deqeueAlpineTag(builtTags) {
  return dequeueBuildTag(AlpineBuildQueueFile, builtTags, true);
}

function cleanupDocker() {
  Logger.debug("Removing all unused Docker containers & images");
  tryExec("docker container prune -f");
  tryExec("docker image prune -af");
}

function sendMail(content) {
  Logger.debug("Sending email:", content);
  if (!isWindows) {
    let escaped = content.replace('"', '\"');
    tryExec(`echo "Subject:[minimeteor]\\n\\n${escaped}" | /usr/sbin/sendmail korteur@gmail.com`);
  }
}

/**
 * Spawns a shell command, writes everything to console AND returns stdout promise.
 * @param command {string}
 * @param parameters {[string]}
 * @returns {Promise<{output: string, exitCode: number}>}
 */
function spawnAsync(command, parameters) {
  Logger.debug("Spawning command:", command, parameters.join(" "));
  let process = child_process.spawn(command, parameters, {stdio: [null, null, "inherit"]});
  let output = "";
  process.stdout.on('data', data => {
    let s = data.toString();
    process.stdout.write(s);
    output += s;
  });
  return new Promise((resolve) => {
    process.on('close', exitCode => {
      resolve({output, exitCode});
    });
  });
}

const Util = {
  enqueueCommand,
  getMeteorQueue,
  setMeteorQueue,
  getAlpineQueue,
  setAlpineQueue,
  enqueueMeteorTag,
  enqueueAlpineTag,
  deqeueMeteorTag,
  deqeueAlpineTag,
  spoolMeteorBuilder,
  exec,
  tryExec,
  retExec,
  cleanupDocker,
  sendMail,
  spawnAsync,
};

module.exports = Util;