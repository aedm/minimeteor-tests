"use strict";

// This script takes Node.js versions from a file,
// and builds the first not-yet-built "alpinebuilder" image from it.

const spawnSync = require('child_process').spawnSync;
const execSync = require('child_process').execSync;
const fs = require('fs');

const DockerHub = require("./lib/dockerhub.js");
const Util = require("./lib/util.js");
const Config = require("./lib/config.js");
const Logger = require("./lib/logger.js");

function makeTempDir() {
  let command = spawnSync("mktemp", ["-d"]);
  if (command.error) {
    Logger.error("Cannot create temp directory");
    process.exit(1);
  }
  return command.stdout.toString().trim();
}


function getAlpineBuilderDockerfile(nodeVersion) {
  return `# Dockerfile
FROM mhart/alpine-node:${nodeVersion}
RUN apk add --no-cache make gcc g++ python`;
}


function buildAlpineBuilder(dockerTags, tempDir) {
  let nodeVersion = Util.deqeueAlpineTag(dockerTags);
  if (!nodeVersion) {
    Logger.log("Nothing to build.");
    return;
  }

  let dockerTag = `${Config.DOCKER_OWNER}/${Config.DOCKER_ALPINE_IMAGE}:${nodeVersion}`;
  Logger.log("Building ", dockerTag);

  let content = getAlpineBuilderDockerfile(nodeVersion);
  fs.writeFileSync(`${tempDir}/Dockerfile`, content);

  console.log("Running docker build...");
  let dockerCommand = spawnSync("docker", ["build", "-t", dockerTag, tempDir], {stdio: "inherit"});
  if (dockerCommand.status) {
    Util.sendMail(`FAILED: ${dockerTag}`);
    Logger.error("Build failed.");
    return;
  }
  Logger.log("Build succesful, pushing to Docker Hub.");
  if (Util.exec(`docker push ${dockerTag}`)) {
    Util.sendMail(`${dockerTag} built.`);
  } else {
    Util.sendMail(`FAILED: ${dockerTag} was built, but can't be sent to Docker Hub.`);
  }

  Util.cleanupDocker();
  Logger.log("Alpine build successful:", nodeVersion);
}


function main() {
  Logger.log("======================================================");
  Logger.log("Alpine builder");

  let tempDir = makeTempDir();
  console.log("Using temp directory", tempDir);

  DockerHub.getDockerHubTagNames(Config.DOCKER_OWNER, Config.DOCKER_ALPINE_IMAGE)
  .then(dockerTags => {
    buildAlpineBuilder(dockerTags, tempDir);

    console.log("Removing temp directory", tempDir);
    spawnSync("rm", ["-rf", tempDir]);
  });
}

main();

