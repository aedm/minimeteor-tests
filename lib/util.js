"use strict";

const fs = require('fs');
const escape = require('escape-html');
const execSync = require('child_process').execSync;
const Config = require("./config.js");
const Logger = require("./logger.js");

let MinimeteorDir = null;
let MeteorBuildQueueFile = null;
let AlpineBuildQueueFile = null;

(function() {
  MinimeteorDir = process.env[Config.METEORCRAWLER_DIR_ENV];
  if (!MinimeteorDir) {
    Logger.error("Cannot find environment variable", Config.METEORCRAWLER_DIR_ENV);
    process.exit(1);
  }
  try {
    fs.accessSync(MinimeteorDir, fs.W_OK);
  } catch (ex) {
    Logger.error(ex.toString());
    Logger.error("Cannot write into directory", MinimeteorDir);
    process.exit(1);
  }
  MeteorBuildQueueFile = `${MinimeteorDir}/${Config.METEOR_BUILD_QUEUE_FILE}`;
  AlpineBuildQueueFile = `${MinimeteorDir}/${Config.ALPINE_BUILD_QUEUE_FILE}`;
})();

/**
  Adds a command to the Linux task spooler. Uses "tsp".
 */
function enqueueCommand(command) {
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

function getQueueFile(file) {
  try {
    let fileContent = fs.readFileSync(file).toString();
    return fileContent.split(/[\r\n]+/g).filter(line => line !== "");
  } catch (ex) {
    // If the file doesn't exist, that's ok.
    if (ex.code == "ENOENT") return [];
    Logger.error(ex.toString());
  }
}

function writeQueueFile(file, tags) {
  fs.writeFileSync(file, tags.join("\n") + "\n");
}

function enqueueBuild(file, tag) {
  let lines = getQueueFile(file);
  if (!lines.find(line => line == tag)) {
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
 * @returns tag to build next
 */
function dequeueBuildTag(file, builtTags, leaveInQueue) {
  let tags = getQueueFile(file);

  let tag = null;
  while (tags.length > 0) {
    tag = tags.shift();
    if (!builtTags.find(x => x == tag)) {
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
 * @param builtTags Already built images on Docker Hub
 * @returns tag to build next
 */
function deqeueMeteorTag(builtTags) {
  return dequeueBuildTag(MeteorBuildQueueFile, builtTags, false);
}

/**
 * Dequeues Alpine build list.
 * @param builtTags Already built images on Docker Hub
 * @returns tag to build next
 */
function deqeueAlpineTag(builtTags) {
  return dequeueBuildTag(AlpineBuildQueueFile, builtTags, true);
}

function wipeDockerImages() {
  Logger.debug("Removing all Ddocker images");
  tryExec("docker rm $(docker ps -aq); docker rmi $(docker images -q)");
}

function sendMail(content) {
  let escaped = content.replace('"', '\"');
  tryExec(`echo "Subject:[minimeteor]\\n\\n${escaped}" | /usr/sbin/sendmail korteur@gmail.com`);
}


module.exports = {
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
  wipeDockerImages,
  sendMail,
};
