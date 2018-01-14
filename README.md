# Minimeteor tests

Minimeteor testing framework. Looks for newly released 
Meteor versions on GitHub and tests Minimeteor using each
of them to make sure Minimeteor is compatible with every
released version of Meteor.

**Warning:** you probably don't need this. It's only here to show
everyone how Minimeteor compatibility is tested.

### Prerequirements

* Linux
* Node 8+ 
* Docker 1.25+
* tsp task spooler

### Setup

* Copy `.env-example` to `.env`, add your GitHub access token 
and Docker username to it
* Add this command to crontab at a regular interval (eg. hourly):
`tsp -n bash -c "node /path-to-dir/main.js`

### How it works

First, it builds Meteor docker images, which are simple
Debian images with Meteor installed.

It then uses them to create new Meteor projects using `meteor create`
and builds them with Minimeteor. It also runs these test images and
runs an HTTP GET against them to make sure they really host what
looks like a Meteor web app.

Whenever there's trouble or a successful build, it sends an email.