'use strict';
require('dotenv').config();
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

const Hapi = require('hapi');
const Inert = require('inert');

const { files, podcast, indexRoute, podcastShort } = require('./lib/routes/');
const { favicon } = require('./lib/plugins/');

const server = new Hapi.Server({
  port: process.env.PORT || 8888
});

const provision = async () => {
  // Add the route
  await server.register(Inert);

  server.route([indexRoute, files, podcast, podcastShort]);

  // Start the server
  try {
    await server.register([
      {
        plugin: Inert
      }
    ]);
    await server
      .start()
      .then(() => console.log(`Server v${process.env.npm_package_version} running:`, server.info));
  } catch (err) {
    console.log(err);
  }
};
provision();
