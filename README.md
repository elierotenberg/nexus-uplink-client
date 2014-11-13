Nexus Uplink Client
===================

Nexus Uplink is an extension of REST semantics to enable real-time update push notifications from a server to the subscribing clients.
It relies on simple HTTP request/responses and a secondary server-to-client push channel (implemented using the socket.io protocol).

Inspired by the Flux data-flow concepts of Facebook, data flows only one way, avoiding many of the pitfalls of asynchronous data management.

From the clients perspective, Uplink exposes an abstract store with subscribing (read-only), and an abstract action dispatcher (write-only).
From the servers perspective, Uplink exposes an abstract store with publishing (write-only), and an abstract action handler (read-only).

Typical data flow:

user clicks a button -> dispatch 'do something' -[ action packet is sent over the wire ]-> handle 'do something'
-> mutate store -> publish updates to subscribers clients -[ update packet is sent over the wire ]-> update subscribers objects

The client in this repo is isomorphic, ie. it can be require()-d in either a browser or in node and work with the same API.
To implement the HTTP requests, it relies on `browser-request` in the browser and `request` on node.
To implement the WebSocket client, it relies on `socket.io-client` in both the browser and node.
