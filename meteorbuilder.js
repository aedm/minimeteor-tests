"use strict";

const spawn = require('child_process').spawn;
const execSync = require('child_process').execSync;
const fs = require('fs');
const stream = require('stream');

const DockerHub = require("./lib/dockerhub.js");
const Util = require("./lib/util.js");
const Config = require("./lib/config.js");
const Version = require("./lib/version.js");
const Logger = require("./lib/logger.js");

const NodeLabel = "METEORCRAWLER_NODE_VERSION=";

function makeTempDir() {
  try {
    return execSync("mktemp -d").toString().trim();
  } catch (ex) {
    console.error("Cannot create temp directory");
    process.exit(1);
  }
}

function getMeteorDockerfile(meteorVersionString) {
  let releaseURL = "https://install.meteor.com/?release=" + meteorVersionString;
  let version = Version.fromString(meteorVersionString);

  let meteorCommandSwitches = [];
  if (version.isAtLeast([1, 4, 2]) && version.isLessThan([1, 4, 2, 1])) {
    meteorCommandSwitches.push("--unsafe-perm");
  }
  if (version.isAtLeast([1, 4, 2, 1])) {
    meteorCommandSwitches.push("--allow-superuser");
  }
  let meteorSwitch = meteorCommandSwitches.join(" ");

  // Installed packages:
  // - curl: to te able to download Meteor
  // - procps, python, g++, make: to build NPM libraries
  // - sudo: to run tools as non-root
  // - locales: for MongoDB
  // - libfontconfig: for PhantomJS (Meteor testing)
  return `# Dockerfile
FROM debian:wheezy-slim
ENV DEBIAN_FRONTEND noninteractive

# Install tools
RUN apt-get -qq update \
 && apt-get -qq install curl procps python g++ make sudo locales libfontconfig git bzip2 >/dev/null \
 && apt-get clean \
 && locale-gen en_US.UTF-8 \
 && localedef -i en_GB -f UTF-8 en_US.UTF-8 \
 && curl ${releaseURL} | sh \
 && echo ${NodeLabel}\`meteor node --version\`  # ${Date.now().toString()}
`;
}


function buildMeteor(meteorVersion) {
  let tempDir = makeTempDir();
  Logger.debug("Using temp directory", tempDir);

  let dockerTag = `${Config.DOCKER_OWNER}/${Config.DOCKER_METEOR_IMAGE}:${meteorVersion}`;
  Logger.log("Building", dockerTag);

  let content = getMeteorDockerfile(meteorVersion);
  fs.writeFileSync(`${tempDir}/Dockerfile`, content);

  Logger.log("Running docker build...");
  let dockerProcess = spawn("docker", ["build", "-t", dockerTag, tempDir],
      {stdio: [null, null, "inherit"]});

  let output = "";
  dockerProcess.stdout.on('data', data => {
    let s = data.toString();
    process.stdout.write(s);
    output += s;
  });
  dockerProcess.on('close', code => {
    Util.exec(`rm -rf ${tempDir}`);
    if (code) {
      Util.sendMail(`FAILED: ${dockerTag}`);
      Logger.error("Build failed. Exit code:", code);
      return;
    }
    Logger.log("Build succesful.");

    // Enqueue alpine build
    let nodeVersion = output.split("\n").
      find(s => s.indexOf(NodeLabel) >= 0 && s.indexOf(`echo ${NodeLabel}`) < 0);
    if (!nodeVersion) {
      Logger.error("Node version not found, quitting.");
      Util.sendMail(`FAILED: ${dockerTag}`);
      return;
    }

    Logger.log("Found Node version", nodeVersion);
    nodeVersion = nodeVersion.substring(
        nodeVersion.indexOf(NodeLabel) + NodeLabel.length).replace(/^(v)/, "");
    Util.enqueueAlpineTag(nodeVersion);

    // Push docker image
    Logger.log("Pushing image to Docker Hub");
    if (Util.exec(`docker push ${dockerTag}`)) {
      Util.sendMail(`${dockerTag} built.`);
    } else {
      Util.sendMail(`FAILED: ${dockerTag} was built, but can't be sent to Docker Hub.`);
    }

    Util.wipeDockerImages();
    Logger.log("Build successful:", dockerTag);
  });
}


function main() {
  if (process.argv.length > 3) {
    console.log(`Usage: node build-meteor.js [meteor-version]`);
    process.exit(0);
  }

  Logger.log("======================================================");
  Logger.log("Meteor builder");

  let versionFromCommandLine = (process.argv.length == 3);
  let meteorVersion = null;
  if (versionFromCommandLine) {
    meteorVersion = process.argv[2];
  }

  DockerHub.getDockerHubTags(Config.DOCKER_OWNER, Config.DOCKER_METEOR_IMAGE)
  .then(dockerTags => {
    if (versionFromCommandLine) {
      // Check whether this version is already built
      if (dockerTags.find(tag => tag == meteorVersion)) {
        Logger.log("Already built", meteorVersion);
        return;
      }
    } else {
      // Find a version that's not built yet
      meteorVersion = Util.deqeueMeteorTag(dockerTags);
      if (!meteorVersion) {
        Logger.log("Nothing to build");
        return;
      }
    }
    buildMeteor(meteorVersion);

    if (!versionFromCommandLine) {
      // If the build version comes from the queue, there might be more of it
      Util.spoolMeteorBuilder();
    }
  });
}

main();

