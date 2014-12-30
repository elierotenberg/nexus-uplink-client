const { Message, MESSAGE_TYPES } = require('nexus-uplink-common');
const Remutable = require('remutable');
const { Patch } = Remutable;
const { Requester } = require('immutable-request');
const url = require('url');
const _ = require('lodash-next');

let _Engine = void 0; // alias of Engine to shut-up jshint

class BoundAction {
  constructor({ path, engine }) {
    _.dev(() => {
      path.should.be.a.String;
      engine.should.be.an.instanceOf(_Engine);
    });
    _.extend(this, {
      _path: path,
      _engine: engine,
    });
  }

  dispatch(params) {
    this._engine.dispatch(this._path, params);
  }
}

_.extend(BoundAction.prototype, {
  _path: null,
  _engine: null,
});

// Read-only pseudo-proxy with bound discard method
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

  discard() {
    Object.keys(this._deleteHandlers).forEach((id) => this.offDelete(id));
    this._remutable = null;
    return this._engine.unsubscribe({ id: this._id, path: this._path });
  }
}

_.extend(BoundRemutable.prototype, {
    _id: null,
    _path: null,
    _remutable: null,
    _engine: null,
    _deleteHandlers: null,
});

class Engine {
  constructor(clientSecret) {
    _.dev(() => clientSecret.should.be.a.String);
    _.extend(this, {
      _clientSecret: clientSecret,
      _requester: null,
      _subscribers: {},
      _remotelySubscribed: {},
      _stores: {},
      _patches: {},
      _refetching: {},
      _socket: null,
      _pid: null,
      _previousPid: null,
      _handshake: null,
    });
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

  createAction(path) { // handy fluent api: engine.action(path).dispatch(params)
    _.dev(() => path.should.be.a.String);
    return new BoundAction({ path, engine: this });
  }

  dispatch(path, params = null) {
    _.dev(() => {
      path.should.be.a.String;
      (params === null || _.isObject(params)).should.be.ok;
      (this._socket !== null || this._requester !== null).should.be.ok;
    });
    if(this._socket && this._pid !== null) { // if the socket fastpath is available, use it
      const message = Message.Dispatch({ action: path, params });
      this._socket.send(message);
    }
    else { // otherwise,
      this._requester.POST(path, { clientSecret: this._clientSecret, params });
    }
  }

  createStore(path) { // fluent api alias
    return this.subscribe(path);
  }

  subscribe(path) { // subscribe and return a BoundRemutable, aka a Remutable getter and onChange/onDelete observer
    _.dev(() => path.should.be.a.String);
    if(this._subscribers[path] === void 0) {
      this._subscribers[path] = {};
    }
    const remutable = this.maybeSubscribe(path);
    const id = _.uniqueId(`s${path}`);
    this._subscribers[path][id] = new BoundRemutable({
      id,
      path,
      remutable,
      engine: this,
    });
    return this._subscribers[path][id];
  }

  unsubscribe({ id, path }) {
    _.dev(() => {
      id.should.be.a.String;
      path.should.be.a.String;
      (this._subscribers[path] !== void 0).should.be.ok;
      (this._subscribers[path][id] !== void 0).should.be.ok;
    });
    delete this._subscribers[path][id];
  }

  fetch(path) { // simply fetch the last (server or client)-cached version of the given path and return a Remutable
    return this._requester.GET(path, { type: 'json' })
    .then((json) => {
      const remutable = Remutable.fromJSON(json);
      // Maybe this version is more recent than ours
      this.handleRefetch(path, remutable);
      return remutable.head;
    });
  }

  handleConnection(socket) {
    _.dev(() => {
      (this._socket === null).should.be.ok;
      (this._pid === null).should.be.ok;
      (this._handshake === null).should.be.ok;
    });
    this._socket = socket;
    this.handshake();
  }

  handleDisconnection() {
    _.dev(() => {
      (this._socket !== null).should.be.ok;
    });
    this._socket = null;
    this._handshake = null;
    this._previousPid = this._pid;
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
      (this._handshake !== null).should.be.ok;
      this._handshake.promise.isPending().should.be.ok;
    });
    if(this._previousPid !== null && pid !== this._previousPid) { // The server has changed (new shard or reboot), reset all remotely subscribed
      this._remotelySubscribed = {};
    }
    this._pid = pid;
    // Update subscriptions: remotely subscribe to everything that should be subscribed,
    // and remotely unsubscribe from everything that should not be subscribed
    Object.keys(this._subscribers).forEach((path) => this.maybeSubscribe(path));
    Object.keys(this._remotelySubscribed).forEach((path) => this.maybeUnsubscribe(path));
    this._handshake.resolve();
  }

  handleUpdate({ path, patch }) {
    _.dev(() => {
      path.should.be.a.String;
    });
    this.handleReceivePatch(path, patch);
  }

  handleDelete({ path }) {
    if(this._subscribers[path] === void 0) {
      return;
    }
    _.each(this._subscribers[path], (subscriber) => subscriber.triggerDelete());
  }

  handleError({ err }) {
    _.dev(() => { throw err; });
  }

  handshake() {
    _.dev(() => {
      (this._socket !== null).should.be.ok;
      (this._pid === null).should.be.ok;
    });
    if(this._handshake !== null) {
      return this._handshake.promise;
    }
    this._handshake = {
      resolve: null,
      reject: null,
      promise: null,
    };
    this._handshake.promise = new Promise((resolve, reject) => _.extend(this._handshake, { resolve, reject }));
    const message = Message.Handshake({ clientSecre: this._clientSecret });
    this._socket.send(message);
  }

  // Recursively apply all available patches and then clear all outdated patches
  // Return the number of patches applied
  applyAllPatches(path) {
    _.dev(() => {
      path.should.be.a.String;
      (this._stores[path] !== void 0).should.be.ok;
      (this._patches[path] !== void 0).should.be.ok;
    });
    const { hash, version } = this._stores[path];
    const patch = this._patches[path][hash];
    if(patch === void 0) {
      this.clearOutdatedPatches(path, version);
      return 0;
    }
    else { // Explicit if finished then return else continue recursion
      delete this._patches[path][hash];
      this._stores[path].apply(patch);
      return 1 + this.applyAllPatches(path);
    }
  }

  // Delete references to all stored patches with a version number below
  // the current version
  clearOutdatedPatches(path, version) {
    _.dev(() => {
      path.should.be.a.String;
      (this._patches[path] !== void 0).should.be.ok;
    });
    _.each(this._patches[path], (patch, hash) => {
      // Either this patch applies to a strictly previous version,
      // or it updates to a (not strictly) previous version
      if(patch.from.v < version || patch.to.v <= version) {
        delete this._patches[path][hash];
      }
    });
  }

  // A refetching is complete, maybe we can update our version
  handleReceiveRemutable(path, next) {
    _.dev(() => {
      path.should.be.a.String;
      next.should.be.an.instanceOf(Remutable);
    });
    if(this._stores[path] === void 0) { // we are no more interested, dismiss
      return;
    }
    const prev = this._stores[path];
    if(next.version <= prev.version) { // we already have an equally or more recent version
      return;
    }
    const diffPatch = Patch.fromDiff(prev, next);
    this.handleReceivePatch(path, diffPatch);
  }

  // A new patch is available, maybe we can update our version. If not, then
  // we must update to a more recent version.
  handleReceivePatch(path, patch) {
    _.dev(() => {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(Remutable.Patch);
    });
    if(this._stores[path] === void 0) { // we are not interested, dismiss
      return;
    }
    const prev = this._stores[path];
    if(patch.to.v <= prev.version) { // we already have an equally or more recent version
      return;
    }
    _.dev(() => (this._patches[path] !== void 0).should.be.ok);
    this._patches[path][patch.from.h] = patch;
    if(this.applyAllPatches(path) === 0) { // no patch applied means we are out of sync and we must refetch
      this.refetch(path, patch.to.v);
    }
  }

  maybeSubscribe(path) {
    if(this._remotelySubscribed[path] !== void 0) {
      _.dev(() => (this._stores[path] !== void 0).should.be.ok);
      return this._stores[path];
    }
    if(this._subscribers[path] === void 0) {
      return;
    }
    if(this._pid !== null) { // connected and handshaked
      const message = Message.Subscribe({ path });
      this._socket.send(message);
      this._remotelySubscribed[path] = true;
    }
    this._stores[path] = new Remutable();
    this._patches[path] = {};
    this._refetching[path] = this.refetch(path);
    return this._stores[path];
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
    if(this._refetching[path] && this._refetching[path].isPending()) {
      this._refetching[path].cancel(new Error(`Unsubscribed from ${path}`));
    }
    this._stores[path].destroy();
    delete this._stores[path];
    delete this._refetching[path];
    delete this._patches[path];
  }

  refetch(path, version) { // refetch path, and require an equal or newer version (an even more recent version than expected can come back)
    _.dev(() => {
      path.should.be.a.String;
      version.should.be.a.Number;
      (this._stores[path] !== void 0).should.be.ok;
      (this._refetching[path] !== void 0).should.be.ok;
      (this._patches[path] !== void 0).should.be.ok;
    });
    if(this._refetching[path]) { // we are already refetching
      return;
    }
    _.dev(() => (this._requester !== null).should.be.ok);
    this._refetching[path] = true;
    let u = url.parse(path, true);
    //_v?=${version} means that a version AT LEAST AS RECENT as version will be fetched (it can be newer)
    u.query._v = version;
    u.search = null; // erase u.search so that u.query is used by format
    u = url.format(u);
    // Since the version fetched will be >= version, we can delete outdated patches already
    this.clearOutdatedPatches(path, version);
    return this._requester.GET(u, { type: 'json' })
    .catch((err) => {
      _.dev(() => { throw err; });
      this._refetching[path] = null;
    })
    .then((json) => {
      this._refetching[path] = null;
      const remutable = Remutable.fromJSON(json);
      return this.handleReceiveRemutable(path, remutable);
    });
  }
}


_.extend(Engine.prototype, {
  _clientSecret: null,
  _requester: null,
  _subscribers: null,
  _remotelySubscribed: null,
  _stores: null,
  _patches: null,
  _refetching: null,
  _socket: null,
  _pid: null,
  _previousPid: null,
  _handshake: null,
});

_Engine = Engine;

module.exports = Engine;
