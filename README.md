Nexus Uplink Client (Isomorphic)
================================

Nexus Uplink is an dead-simple, lightweight protocol on top of which Flux over the Wire can be implemented.

[On the client side](https://github.com/elierotenberg/nexus-uplink-client), a Nexus Uplink Client can react to stores updates, and dispatch actions.
[On the server side](https://github.com/elierotenberg/nexus-uplink-simple-server), a Nexus Uplink Server can react to actions dispatchs, and update stores.

Briefly:
- actions are transported via POST requests (url pathname is the action identifier, JSON-encoded body is the payload)
- updates are transported via Websocket (or Engine.IO fallback) (as diff objects)

This package is an isomorphic (which means it can run on either Node.js or in the browser via browserify/webpack) implementation  of the Nexus Uplink client-side protocol.
Also see the [simple server implementation](https://github.com/elierotenberg/nexus-uplink-simple-server) of the Nexus Uplink server-side protocol.

Example
=======

On the server:

```js
var server = new UplinkSimpleServer({
  pid: _.guid('pid'),
  // stores, rooms and actions are url patterns whitelists
  stores: ['/ping'],
  rooms: [],
  actions: ['/ping'],
  // pass an express or express-like app
  app: express().use(cors())
});

var pingCounter = 0;

// setup action handlers
server.actions.on('/ping', function(payload) {
  // guid is a cryptosecure unique user id, automatically maintained
  var guid = payload.guid;
  var remoteDate = payload.localDate;
  var localDate = Date.now();
  console.log('client ' + guid + ' pinged.');
  console.log('latency is ' + (localDate - remoteDate) + '.');
  pingCounter++;
  server.update({ path: '/ping', value: { counter: pingCounter }});
});

```

On the client:

```js
var client = new Uplink({ url: 'http://localhost' });

// subscribe to remote updates
client.subscribeTo('/ping', function(ping) {
  console.log('ping updated', ping.counter);
});

// fire-and-forget dispatch actions
setInterval(function() {
  client.dispatch('/ping', { localDate: Date.now() });
}, 1000);
```

Installation
============

`npm install nexus-uplink-simple-server --save`
