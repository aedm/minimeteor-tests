"use strict";

const child_process = require('child_process');
const execSync = require('child_process').execSync;
const Config = require("./config.js");
const Logger = require("./logger.js");

const isWindows = /^win/.test(process.platform);

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function tryExec(command) {
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
  Logger.log("Executing:", command);
  execSync(command, {stdio: "inherit"});
}

function retExec(command) {
  Logger.log("Executing:", command);
  let retVal = execSync(command).toString().trim();
  Logger.debug("Command returned:", retVal);
  return retVal;
}

function spoolMeteorBuilder() {
  let command = `${Config.NODE_CMD} ${__dirname}/../meteorbuilder.js`;
  enqueueCommand(command);
}

function cleanupDocker() {
  Logger.debug("Removing all unused Docker containers & images");
  tryExec("docker system prune -af");
}

function sendMail(content) {
  Logger.debug("Sending email:", content);
  if (!isWindows) {
    let emailAddress = Config.EMAIL_ADDRESS;
    if (!emailAddress) {
      Logger.error("No email address specified. Please set EMAIL_ADDRESS env variable.")
      return;
    }
    let escaped = content.replace('"', '\"');
    tryExec(`echo "Subject:[minimeteor]\\n\\n${escaped}" | /usr/sbin/sendmail ${emailAddress}`);
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
    Logger.log(s);
    output += s;
  });
  return new Promise((resolve) => {
    process.on('close', exitCode => {
      resolve({output, exitCode});
    });
  });
}

module.exports = {
  enqueueCommand,
  spoolMeteorBuilder,
  exec,
  tryExec,
  retExec,
  cleanupDocker,
  sendMail,
  spawnAsync,
  sleep,
};