"use strict";

const DockerHubAPI = require('docker-hub-api');
const Logger = require("./logger.js");

// Init Docker API
DockerHubAPI.setCacheOptions({enabled: true, time: 60});

async function getDockerHubFullTags(owner, repo) {
  Logger.debug(`Fetching all Docker Hub tags for ${owner}/${repo}`);
  let tags = [];
  for (let page = 1; ; page++) {
    try {
      let list = await DockerHubAPI.tags(owner, repo, {page, perPage: 100});
      list.forEach(x => tags.push(x));
    }
    catch (ex) {
      break;
    }
  }
  Logger.debug(`${tags.length} Docker tags fetched.`);
  return tags;
}

async function getDockerHubTags(owner, repo) {
  let tags = await getDockerHubFullTags(owner, repo);
  return tags.map(x => x.name);
}

module.exports = {
  getDockerHubFullTags,
  getDockerHubTags,
};
