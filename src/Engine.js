const { Message, MESSAGE_TYPES } = require('nexus-uplink-common');
const Remutable = require('remutable');
const { Patch } = Remutable;
const { Requester } = require('immutable-request');

let _Engine = void 0; // alias of Engine to shut-up jshint

// Read-only pseudo-proxy with bound unsubscribe method
class BoundRemutable {
  constructor({ id, path, remutable, engine }) {
    _.dev(() => {
      id.should.be.a.String;
      path.should.be.a.String;
      remutable.should.be.an.instanceOf(Remutable);
      engine.should.be.an.instanceOf(_Engine);
    });
    _.extend(this, {
      _id: id,
      _path: path,
      _remutable: remutable,
      _engine: engine,
      _deleteHandlers: {},
    });
  }

  // Proxy to this._remutable
  get() {
    return this._remutable.get.apply(this._remutable, arguments);
  }

  // Proxy to this._remutable
  get head() {
    return this._remutable.head;
  }

  // Proxy to this._remutable
  onChange() {
    return this._remutable.onChange.apply(this._remutable, arguments);
  }

  // Proxy to this._remutable
  offChange() {
    return this._remutable.offChange.apply(this._remutable, arguments);
  }

  onDelete(fn) {
    _.dev(() => {
      fn.should.be.a.Function;
    });
    const id = _.uniqueId('d');
    this._deleteHandlers[id] = fn;
    return id;
  }

  offDelete(id) {
    _.dev(() => {
      id.should.be.a.String;
      (this._deleteHandlers[id] !== void 0).should.be.ok;
    });
    delete this._deleteHandlers[id];
  }

  triggerDelete() {
    _.each(this._deleteHandlers, (fn) => fn());
  }

  unsubscribe() {
    return this._engine.unsubscribe({ id: this._id, path: this._path });
  }
}

const DEFAULT_REQUEST_TIMEOUT = 5000;

class Engine {
  constructor(options) {
    options = options || {};
    this._requester = null;
    this._subscribers = {};
    this._remotelySubscribed = {};
    this._stores = {};
    this._patches = {};
    this._socket = null;
    this._pid = null;
  }

  set requester(value) {
    _.dev(() => {
      value.should.be.an.instanceOf(Requester);
    });
    this._requester = value;
  }

  get requester() {
    _.dev(() => (this._requester !== null).should.be.ok);
    return this._requester;
  }

  subscribe(path) {
    _.dev(() => path.should.be.a.String);
    if(this._subscribers[path] === void 0) {
      this._subscribers[path] = {};
    }
    this.maybeSubscribe(path);
  }

  fetch(path) {
    return this._requester.GET(path, { type: 'json' })
    .then((json) => {
      const remutable = Remutable.fromJSON(json);
      this.handleRefetch(path, remutable);
      return remutable.head;
    });
  }

  handleConnection(socket) {
    _.dev(() => {
      (this._socket === null).should.be.ok;
      (this._pid === null).should.be.ok;
    });
    this._socket = socket;
  }

  handleDisconnection() {
    _.dev(() => {
      (this._socket !== null).should.be.ok;
    });
    this._socket = null;
    this._pid = null;
  }

  handleMessage(json) {
    _.dev(() => {
      json.should.be.a.String;
    });
    const message = Message.fromJSON(json);
    const { type } = message;
    const interpretation = message.interpret();
    if(type === MESSAGE_TYPES.HANDSHAKE_ACK) {
      return this.handleHandshakeAck(interpretation);
    }
    if(type === MESSAGE_TYPES.UPDATE) {
      return this.handleUpdate(interpretation);
    }
    if(type === MESSAGE_TYPES.DELETE) {
      return this.handleDelete(interpretation);
    }
    if(type === MESSAGE_TYPES.ERROR) {
      return this.handleError(interpretation);
    }
    throw new Error(`Unknown message type: ${type}`);
  }

  handleHandshakeAck({ pid }) {
    _.dev(() => {
      (this._socket !== null).should.be.ok;
      (this._pid === null).should.be.ok;
    });
    this._pid = pid;
    Object.keys(this._subscribers).forEach((path) => this.maybeSubscribe(path));
    Object.keys(this._remotelySubscribed).forEach((path) => this.maybeUnsubscribe(path));
  }

  handleUpdate({ path, patch }) {

  }

  handleDelete({ path }) {
    if(this._subscribers[path] === void 0) {
      return;
    }
    _.each(this._subscribers[path], (subscriber) => subscriber.triggerDelete());
  }

  handleError({ err }) {

  }

  // Recursively apply all available patches and then clear all outdated patches
  // Return the number of patches applied
  applyAllPatches(path) {
    _.dev(() => {
      path.should.be.a.String;
      (this._stores[path] !== void 0).should.be.ok;
    });
    if(this._patches[path] === void 0) {
      return 0;
    }
    const { hash } = this._stores[path];
    const patch = this._patches[path][hash];
    if(patch === void 0) {
      this.clearOutdatedPatches(path);
      return 0;
    }
    delete this._patches[path][hash];
    this._stores[path].apply(patch);
    return 1 + this.applyAllPatches(path);
  }

  // Delete references to all stored patches with a version number below
  // the current version
  clearOutdatedPatches(path) {
    _.dev(() => {
      path.should.be.a.String;
      (this._stores[path] !== void 0).should.be.ok;
    });
    if(this._patches[path] !== void 0) {
      const { version } = this._stores[path];
      _.each(this._patches[path], (patch, hash) => {
        if(patch.version <= version) {
          delete this._patches[path][hash];
        }
      });
    }
  }

  handleReceiveRemutable(path, remutable) {

  }

  handleReceivePatch(path, patch) {

  }

  maybeSubscribe(path) {
    if(this._remotelySubscribed[path] !== void 0) {
      return;
    }
    if(this._subscribers[path] === void 0) {
      return;
    }
    if(this._pid !== null) { // connected and handshaked
      const message = Message.Subscribe({ path });
      this._socket.send(message);
      this._remotelySubscribed[path] = true;
    }
  }

  maybeUnsubscribe(path) {
    if(this._remotelySubscribed[path] === void 0) {
      return;
    }
    if(this._subscribers[path] !== void 0) {
      return;
    }
    if(this._pid !== null) {
      const message = Message.Unsubscribe({ path });
      this._socket.send(message);
      delete this._remotelySubscribed[path];
    }
  }
}

_Engine = Engine;

module.exports = Engine;
