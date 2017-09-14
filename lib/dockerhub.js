"use strict";

const DockerHubAPI = require('docker-hub-api');
const Logger = require("./logger.js");

// Init Docker API
DockerHubAPI.setCacheOptions({enabled: true, time: 60});

module.exports.getDockerHubFullTags = function(owner, repo) {
  Logger.debug(`Fetching all Docker Hub tags for ${owner}/${repo}`);
  return new Promise(function (resolve, reject) {
    let tags = [];

    function getPage(page) {
      //console.log(" page", page);
      DockerHubAPI.tags(owner, repo, {page, perPage: 100}).then(list => {
        list.forEach(x => tags.push(x));
        getPage(page + 1);
      }, () => {
        Logger.debug(`${tags.length} docker tags fetched.`);
        resolve(tags);
      });
    }
    getPage(1);
  });
};

module.exports.getDockerHubTags = function(owner, repo) {
  Logger.debug(`Fetching all Docker Hub tags for ${owner}/${repo}`);
  return new Promise(function (resolve, reject) {
    let tags = [];

    function getPage(page) {
      //console.log(" page", page);
      DockerHubAPI.tags(owner, repo, {page, perPage: 100}).then(list => {
        list.forEach(x => tags.push(x.name));
        getPage(page + 1);
      }, () => {
        Logger.debug(`${tags.length} docker tags fetched.`);
        resolve(tags);
      });
    }
    getPage(1);
  });
};
