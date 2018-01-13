"use strict";

// Build minimeteor script test

const spawn = require('child_process').spawn;
const fs = require('fs');
const stream = require('stream');
const sleep = require('sleep');

const DockerHub = require("./lib/dockerhub.js");
const GitHub = require("./lib/github.js");
const Util = require("./lib/util.js");
const Config = require("./lib/config.js");
const Version = require("./lib/version.js");
const Logger = require("./lib/logger.js");

function dockerTestTag(meteorTag, minimeteorTag) {
  return `${meteorTag}-docker-${minimeteorTag.name}-${minimeteorTag.last_updated.replace(/:/g, "-").replace(/T/g, "_")}`;
}

function gitTestTag(meteorTag, gitBranch) {
  return `${meteorTag}-script-${gitBranch.name}-${gitBranch.commit.sha}`;
}

function makeTempDir() {
  try {
    return Util.retExec("mktemp -d");
  } catch (ex) {
    Logger.error("Cannot create temp directory");
    process.exit(1);
  }
}

function createMeteorProject(targetDir, meteorTag) {
  let meteorCommandSwitches = [];
  let version = Version.fromString(meteorTag);
  if (version.isAtLeast([1, 4, 2]) && version.isLessThan([1, 4, 2, 1])) {
    meteorCommandSwitches.push("--unsafe-perm");
  }
  if (version.isAtLeast([1, 4, 2, 1])) {
    meteorCommandSwitches.push("--allow-superuser");
  }
  let meteorSwitch = meteorCommandSwitches.join(" ");
  let fullMeteorTag = `${Config.DOCKER_OWNER}/${Config.DOCKER_METEOR_IMAGE}:${meteorTag}`;

  let uid = Util.retExec("id -u");
  let meteorCommand = `meteor create ${meteorSwitch} /dockerhost`;
  Util.exec(`timeout 2400 docker run --rm --name autominitest -v ${targetDir}:/dockerhost ${fullMeteorTag} ${meteorCommand}`);
  Util.exec(`docker run --rm --name autominitest -v ${targetDir}:/dockerhost ${fullMeteorTag} chown -R ${uid} /dockerhost`);
}

function buildByDocker(targetDir, fullTestTag) {
  let branch = (fullTestTag.indexOf("development") < 0) ? "" : ":development";
  fs.writeFileSync(targetDir + "/Dockerfile", `FROM aedm/minimeteor${branch}`);
  Util.exec(`docker build -t ${fullTestTag} ${targetDir}`);
}

function buildByScript(targetDir, fullTestTag, gitBranch) {
  let scriptUrl = `https://raw.githubusercontent.com/aedm/minimeteor/${gitBranch}/build.sh`;
  Util.exec(`cd ${targetDir} && timeout 2400 bash -c "curl ${scriptUrl} | sh -s ${fullTestTag}"`);
}

function testMeteor(meteorTag, buildCallback, testTag) {
  Logger.log("Building", testTag);

  let tempDir = makeTempDir();
  let fullTestTag = `${Config.DOCKER_OWNER}/${Config.DOCKER_BUILD_TEST_IMAGE}:${testTag}`;

  try {
    createMeteorProject(tempDir, meteorTag);
    buildCallback(tempDir, fullTestTag);
    Util.exec(`docker run -d --name autominitest --link mongo -e ROOT_URL=http://localhost -e MONGO_URL=mongodb://mongo/autominitest ${fullTestTag}`);
    Logger.log("Test container started");
    let containerIp = Util.retExec("docker inspect --format '{{ .NetworkSettings.Networks.bridge.IPAddress }}' autominitest");
    let httpContent = null;
    for (let i = 0; httpContent === null && i < 20; i++) {
      try {
        httpContent = Util.retExec(`curl http://${containerIp}:3000`);
      }
      catch (ex) {
        Logger.log("Test server didn't respond, logs:");
        Util.exec(`docker logs autominitest`);
        Logger.log("Sleeping 1 second...");
        sleep.sleep(1);
      }
    }
    if (httpContent === null) throw "Test server is permanently down.";
    if (!httpContent.startsWith("<!DOCTYPE html>")) throw "Response is not HTML";
    if (httpContent.indexOf("meteor") < 0) throw "HTML content probably invalid";
    Logger.log("Test succesful");
    Util.sendMail("TEST PASSED: " + fullTestTag);
    Util.exec(`docker push ${fullTestTag}`);
    Util.enqueueCommand(`${Config.NODE_CMD} ${__dirname}/minimeteortest.js`);
  }
  catch (ex) {
    let errstr = JSON.stringify(ex);
    Util.sendMail(`TEST FAILED: ${testTag}\n${errstr}`);
    Logger.error(errstr);
  }
  Util.tryExec(`docker stop autominitest`, {stdio: "inherit"});
  Util.tryExec(`docker rm autominitest`, {stdio: "inherit"});
  Util.tryExec(`docker stop minimeteor-${fullTestTag.replace(/[:/]/g, "--")}`, {stdio: "inherit"});
  Util.tryExec(`rm -rf ${tempDir}`);
  Util.cleanupDocker();
  console.log("Finished building", testTag);
}


function main() {
  Logger.log("======================================================");
  Logger.log("Starting MiniMeteor test");

  let buildTextTags = [];
  let dockerMeteorTags = [];

  // Get all test images on Docker Hub.
  DockerHub.getDockerHubTags(Config.DOCKER_OWNER, Config.DOCKER_BUILD_TEST_IMAGE)
    .then(dockerTags => {
      buildTextTags = dockerTags;
      // Get all prebuilt Meteor images on Docker Hub.
      return DockerHub.getDockerHubTags(Config.DOCKER_OWNER, Config.DOCKER_METEOR_IMAGE);
    })
    .then(dockerTags => {
      // Also find MiniMeteor images on Docker Hub
      dockerMeteorTags = dockerTags.filter((tag, index) => {
        if (index == 0) return true;
        let version = Version.fromString(tag);
        return !!version && !version.isSubversion && !version.isLessThan([1, 3, 3]) && version.nums.length <= 3;
      });
      dockerMeteorTags.sort();
      return DockerHub.getDockerHubFullTags(Config.DOCKER_OWNER, Config.DOCKER_MINIMETEOR_IMAGE);
    })
    .then(dockerMiniMeteorTags => {
      // Check if there's an unbuilt Docker test that can be performed
      for (let dockerMiniMeteorTag of dockerMiniMeteorTags) {
        let tagToBuild = dockerMeteorTags.find(dockerMeteorTag => {
          let testTag = dockerTestTag(dockerMeteorTag, dockerMiniMeteorTag);
          return !buildTextTags.find(x => x === testTag);
        });
        if (tagToBuild) {
          let testTag = dockerTestTag(tagToBuild, dockerMiniMeteorTag);
          testMeteor(tagToBuild, buildByDocker, testTag);
          return;
        }
      }
      // If no Docker tests can be run, get the MiniMeteor script commits from GitHub
      return GitHub.getGitBranches("aedm", "minimeteor", ["master", "development"]);
    })
    .then(gitBranches => {
      // Check if there's an unbuilt script test that can be performed
      if (!gitBranches) return;
      for (let gitBranch of gitBranches) {
        Logger.debug("Commit SHA:", gitBranch.commit.sha);
        let tagToBuild = dockerMeteorTags.find(tag => {
          let testTag = gitTestTag(tag, gitBranch);
          return !buildTextTags.find(x => x == testTag);
        });
        if (tagToBuild) {
          let testTag = gitTestTag(tagToBuild, gitBranch);
          let buildCallback = (targetDir, fullTestTag) => {
            return buildByScript(targetDir, fullTestTag, gitBranch.name);
          };
          Logger.log(`Found untested Git commit on ${gitBranch.name} branch.`);
          testMeteor(tagToBuild, buildCallback, testTag);
          return;
        }
      }
      Logger.log("Every version was built, exiting.");
    })
    .catch(error => {
      Logger.error(error.message);
    });
}

main();


