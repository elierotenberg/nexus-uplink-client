Nexus Uplink Client
===================

Nexus Uplink is an dead-simple, lightweight microprotocol over HTTP and Websockets on top of which [Flux over the Wire](codepen.io/write/flux-over-the-wire-part-1) can be implemented.

This package contains the implementation of the __client side__ component of Nexus Uplink.
For the __server side__ component, see [nexus-uplink-simple-server](https://github.com/elierotenberg/nexus-uplink-simple-server).

Nexus Uplink combines very well with [React](http://facebook.github.io/react/) views on the client, and particularly with [React Nexus](https://github.com/elierotenberg/react-nexus), but it is not tied to either of these projects.
### Core principles

Nexus Uplink is a simple communication protocol to allow:
- Clients to fetch values, and receive updates, from a server-side store
- Clients to send actions, to a server-side dispatcher
- Server to respond to actions, and mutate the store

Implementation roughly is:
- Store values are exposed via HTTP GET: clients can simply fire an HTTP GET request to retrieve them.
- Actions are send via HTTP POST: clients can simply fire an HTTP POST request to send them.
- Updates are dispatched via Websockets (or socket.io fallback)

```
        +--- stringify action ---> HTTP POST request --- parse action ---+
        ^                                                                |
        |                                                                v
Nexus Uplink Client                                             Nexus Uplink Server
        ^                                                                |
        |                                                                v
        +--- parse update --- Websocket message <--- stringify update ---+
```


### Performance first

Nexus Uplink is designed and implemented with strong performance concerns in minds.
It is built from the ground up to support:
- Tens of thousands of concurrent users (more with the upcoming redis-based server implementation)
- Thousands of updates per second
- Thousands of actions per second

This bleeding edge performance is achieved using:
- [Immutable](https://github.com/facebook/immutable-js) internals, wrapped in [Remutable](https://github.com/elierotenberg/remutable) for ultra efficient patch broadcasting
- Easy caching without cache invalidation pain (handled by the protocol), just put the server behind Varnish/nginx/whatever caching proxy and you're good to go
- Optimized lazy memoization of message and patches JSON-encoding
- One-way data flow
- Action fast-path using the client-server Websocket channel when available
- Easy and configurable transaction-based updates batching


### Example (server-side)

```js
const { Engine, Server } = require('nexus-uplink-server');
const engine = new Engine();
const server = new Server(engine);
// get (and implicitly instantiate) stores references
// it is similar to a Remutable (map) instance, and is initially empty
const todoList = engine.get('/todoList');
const counters = engine.get('/counters');
// Every 100ms, do a batch update: commit all
// stores updates and sent patches to relevant
// subscribers.
setInterval(() => engine.comitAll(), 100);
engine.addActionHandler('/add-todo-item', (clientID, { name, description }) => {
  // schedule an update for the next commit
  todoList.set(name, {
    description,
    addedBy: clientID,
  });
});
engine.addActionHandler('/complete-todo-item', (clientID, { name }) => {
  // todoList.working points to the current version, including non-commited changes
  if(todoList.working.has(name) &&
    todoList.working.get(name).addedBy === clientID) {
    // schedule a deletion for the next commit
    todoList.delete(name);
  }
  // We can commit immediatly and individually, though we should do this
  // carefully to avoid spamming clients
  todoList.commit();
});
// /session/create and /session/destroy are special, reserved actions
engine.addActionHandler('/session/create', (clientID) => {
  counters.set('active', counters.working.get('active') + 1);
  counters.set('total', counters.working.get('total') + 1);
});
engine.addActionHandler('/session/destroy', (clientID) => {
  counters.set('active', counters.working.get('active') - 1);
});
server.listen(8888);
```

### Example (client-side)

The recommended setup is to install the client from `npm` and then use `browserify` or `webpack` to ship it.

```js
const { Engine, Client } = require('nexus-uplink-client');
// clientSecret must be a globally unique, cryptographic secret
// it is typically generated at server-side rendering time
const Engine = new Engine(clientSecret);
const client = new Client(engine);
// subscribe to several stores
// the returned object is like a Remutable instance, initially empty
const todoList = client.subscribe('/todoList');
const counters = client.subscribe('/counters');
// execute callback everytime a patch is received
todoList.onChange((head, patch) => {
  // 'head' is an Immutable.Map containing the updated values.
  // 'patch' is a Remutable.Patch instance.
  // In most cases though you will just dismiss it
  // and read from the updated object directly, but it can be useful
  // to react directly to update or to implement an undo/redo stack.
  console.log('patch received:', patch);
  console.log('todoList has been updated to', head);
});
counters.onChange((head) => { // here we just ignore the patch argument
  console.log('active users:', head.get('active'));
  console.log('total users:', head.get('total'));
});
client.dispatch('/add-todo-item', {
  name: 'My first item', description: 'This is my first item!'
});
counters.unsubscribe();
// You don't have to subscribe to automatic updates.
// You can also use Nexus Uplink manually.
// fetch returns a Promise for an Immutable.Map.
client.fetch('/counters')
// counters is an Immutable.Map
.then((counters) => console.log('counters received', counters))
.catch((reason) => console.warn('fetching failed because', reason));
```
### Isomorphic client

The protocol is designed so that the client can be (and is) fully isomorphic. It means you can just `require` the client in either Node or the browser and it 'just works'. This is especially useful if you need to implement server-side rendering, as you now have a fully isomorphic data fetching stack.

### Do I have to use ES6?

No you don't, although its really easy and you should try it. `package.json` points to the `dist` folder, which is already transpiled to ES5 using `6to5`.
