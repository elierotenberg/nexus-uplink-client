"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = process.env.NODE_ENV !== "production";var __PROD__ = !__DEV__;var __BROWSER__ = typeof window === "object";var __NODE__ = !__BROWSER__;var _ref = require("nexus-uplink-common");

var Message = _ref.Message;
var MESSAGE_TYPES = _ref.MESSAGE_TYPES;
var Remutable = require("remutable");
var Patch = Remutable.Patch;
var _ref2 = require("immutable-request");

var Requester = _ref2.Requester;
var url = require("url");
var _ = require("lodash-next");

var _Engine = void 0; // alias of Engine to shut-up jshint

var BoundAction = function BoundAction(_ref3) {
  var path = _ref3.path;
  var engine = _ref3.engine;
  _.dev(function () {
    path.should.be.a.String;
    engine.should.be.an.instanceOf(_Engine);
  });
  _.extend(this, {
    _path: path,
    _engine: engine });
};

BoundAction.prototype.dispatch = function (params) {
  this._engine.dispatch(this._path, params);
};

_.extend(BoundAction.prototype, {
  _path: null,
  _engine: null });

// Read-only pseudo-proxy with bound discard method
var BoundRemutable = function BoundRemutable(_ref4) {
  var id = _ref4.id;
  var path = _ref4.path;
  var remutable = _ref4.remutable;
  var engine = _ref4.engine;
  _.dev(function () {
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
    _deleteHandlers: {} });
};

// Proxy to this._remutable
BoundRemutable.prototype.get = function () {
  return this._remutable.get.apply(this._remutable, arguments);
};

// Proxy to this._remutable
BoundRemutable.prototype.onChange = function () {
  return this._remutable.onChange.apply(this._remutable, arguments);
};

// Proxy to this._remutable
BoundRemutable.prototype.offChange = function () {
  return this._remutable.offChange.apply(this._remutable, arguments);
};

BoundRemutable.prototype.onDelete = function (fn) {
  _.dev(function () {
    fn.should.be.a.Function;
  });
  var id = _.uniqueId("d");
  this._deleteHandlers[id] = fn;
  return id;
};

BoundRemutable.prototype.offDelete = function (id) {
  var _this = this;
  _.dev(function () {
    id.should.be.a.String;
    (_this._deleteHandlers[id] !== void 0).should.be.ok;
  });
  delete this._deleteHandlers[id];
};

BoundRemutable.prototype.triggerDelete = function () {
  _.each(this._deleteHandlers, function (fn) {
    return fn();
  });
};

BoundRemutable.prototype.discard = function () {
  var _this2 = this;
  Object.keys(this._deleteHandlers).forEach(function (id) {
    return _this2.offDelete(id);
  });
  this._remutable = null;
  return this._engine.unsubscribe({ id: this._id, path: this._path });
};

_prototypeProperties(BoundRemutable, null, {
  head: {

    // Proxy to this._remutable
    get: function () {
      return this._remutable.head;
    },
    enumerable: true
  }
});

_.extend(BoundRemutable.prototype, {
  _id: null,
  _path: null,
  _remutable: null,
  _engine: null,
  _deleteHandlers: null });

var Engine = function Engine(clientSecret) {
  _.dev(function () {
    return clientSecret.should.be.a.String;
  });
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
    _handshake: null });
};

Engine.prototype.createAction = function (path) {
  // handy fluent api: engine.action(path).dispatch(params)
  _.dev(function () {
    return path.should.be.a.String;
  });
  return new BoundAction({ path: path, engine: this });
};

Engine.prototype.dispatch = function (path, params) {
  var _this3 = this;
  if (params === undefined) params = null;
  _.dev(function () {
    path.should.be.a.String;
    (params === null || _.isObject(params)).should.be.ok;
    (_this3._socket !== null || _this3._requester !== null).should.be.ok;
  });
  if (this._socket && this._pid !== null) {
    // if the socket fastpath is available, use it
    var message = Message.Dispatch({ action: path, params: params });
    this._socket.send(message);
  } else {
    // otherwise,
    this._requester.POST(path, { clientSecret: this._clientSecret, params: params });
  }
};

Engine.prototype.createStore = function (path) {
  // fluent api alias
  return this.subscribe(path);
};

Engine.prototype.subscribe = function (path) {
  // subscribe and return a BoundRemutable, aka a Remutable getter and onChange/onDelete observer
  _.dev(function () {
    return path.should.be.a.String;
  });
  if (this._subscribers[path] === void 0) {
    this._subscribers[path] = {};
  }
  var remutable = this.maybeSubscribe(path);
  var id = _.uniqueId("s" + path);
  this._subscribers[path][id] = new BoundRemutable({
    id: id,
    path: path,
    remutable: remutable,
    engine: this });
  return this._subscribers[path][id];
};

Engine.prototype.unsubscribe = function (_ref5) {
  var _this4 = this;
  var id = _ref5.id;
  var path = _ref5.path;
  _.dev(function () {
    id.should.be.a.String;
    path.should.be.a.String;
    (_this4._subscribers[path] !== void 0).should.be.ok;
    (_this4._subscribers[path][id] !== void 0).should.be.ok;
  });
  delete this._subscribers[path][id];
};

Engine.prototype.fetch = function (path) {
  var _this5 = this;
  // simply fetch the last (server or client)-cached version of the given path and return a Remutable
  return this._requester.GET(path, { type: "json" }).then(function (json) {
    var remutable = Remutable.fromJSON(json);
    // Maybe this version is more recent than ours
    _this5.handleRefetch(path, remutable);
    return remutable.head;
  });
};

Engine.prototype.handleConnection = function (socket) {
  var _this6 = this;
  _.dev(function () {
    (_this6._socket === null).should.be.ok;
    (_this6._pid === null).should.be.ok;
    (_this6._handshake === null).should.be.ok;
  });
  this._socket = socket;
  this.handshake();
};

Engine.prototype.handleDisconnection = function () {
  var _this7 = this;
  _.dev(function () {
    (_this7._socket !== null).should.be.ok;
  });
  this._socket = null;
  this._handshake = null;
  this._previousPid = this._pid;
  this._pid = null;
};

Engine.prototype.handleMessage = function (json) {
  _.dev(function () {
    json.should.be.a.String;
  });
  var message = Message.fromJSON(json);
  var type = message.type;
  var interpretation = message.interpret();
  if (type === MESSAGE_TYPES.HANDSHAKE_ACK) {
    return this.handleHandshakeAck(interpretation);
  }
  if (type === MESSAGE_TYPES.UPDATE) {
    return this.handleUpdate(interpretation);
  }
  if (type === MESSAGE_TYPES.DELETE) {
    return this.handleDelete(interpretation);
  }
  if (type === MESSAGE_TYPES.ERROR) {
    return this.handleError(interpretation);
  }
  throw new Error("Unknown message type: " + type);
};

Engine.prototype.handleHandshakeAck = function (_ref6) {
  var _this8 = this;
  var pid = _ref6.pid;
  _.dev(function () {
    (_this8._socket !== null).should.be.ok;
    (_this8._pid === null).should.be.ok;
    (_this8._handshake !== null).should.be.ok;
    _this8._handshake.promise.isPending().should.be.ok;
  });
  if (this._previousPid !== null && pid !== this._previousPid) {
    // The server has changed (new shard or reboot), reset all remotely subscribed
    this._remotelySubscribed = {};
  }
  this._pid = pid;
  // Update subscriptions: remotely subscribe to everything that should be subscribed,
  // and remotely unsubscribe from everything that should not be subscribed
  Object.keys(this._subscribers).forEach(function (path) {
    return _this8.maybeSubscribe(path);
  });
  Object.keys(this._remotelySubscribed).forEach(function (path) {
    return _this8.maybeUnsubscribe(path);
  });
  this._handshake.resolve();
};

Engine.prototype.handleUpdate = function (_ref7) {
  var path = _ref7.path;
  var patch = _ref7.patch;
  _.dev(function () {
    path.should.be.a.String;
  });
  this.handleReceivePatch(path, patch);
};

Engine.prototype.handleDelete = function (_ref8) {
  var path = _ref8.path;
  if (this._subscribers[path] === void 0) {
    return;
  }
  _.each(this._subscribers[path], function (subscriber) {
    return subscriber.triggerDelete();
  });
};

Engine.prototype.handleError = function (_ref9) {
  var err = _ref9.err;
  _.dev(function () {
    throw err;
  });
};

Engine.prototype.handshake = function () {
  var _this9 = this;
  _.dev(function () {
    (_this9._socket !== null).should.be.ok;
    (_this9._pid === null).should.be.ok;
  });
  if (this._handshake !== null) {
    return this._handshake.promise;
  }
  this._handshake = {
    resolve: null,
    reject: null,
    promise: null };
  this._handshake.promise = new Promise(function (resolve, reject) {
    return _.extend(_this9._handshake, { resolve: resolve, reject: reject });
  });
  var message = Message.Handshake({ clientSecre: this._clientSecret });
  this._socket.send(message);
};

// Recursively apply all available patches and then clear all outdated patches
// Return the number of patches applied
Engine.prototype.applyAllPatches = function (path) {
  var _this10 = this;
  _.dev(function () {
    path.should.be.a.String;
    (_this10._stores[path] !== void 0).should.be.ok;
    (_this10._patches[path] !== void 0).should.be.ok;
  });
  var hash = this._stores[path].hash;
  var version = this._stores[path].version;
  var patch = this._patches[path][hash];
  if (patch === void 0) {
    this.clearOutdatedPatches(path, version);
    return 0;
  } else {
    // Explicit if finished then return else continue recursion
    delete this._patches[path][hash];
    this._stores[path].apply(patch);
    return 1 + this.applyAllPatches(path);
  }
};

// Delete references to all stored patches with a version number below
// the current version
Engine.prototype.clearOutdatedPatches = function (path, version) {
  var _this11 = this;
  _.dev(function () {
    path.should.be.a.String;
    (_this11._patches[path] !== void 0).should.be.ok;
  });
  _.each(this._patches[path], function (patch, hash) {
    // Either this patch applies to a strictly previous version,
    // or it updates to a (not strictly) previous version
    if (patch.from.v < version || patch.to.v <= version) {
      delete _this11._patches[path][hash];
    }
  });
};

// A refetching is complete, maybe we can update our version
Engine.prototype.handleReceiveRemutable = function (path, next) {
  _.dev(function () {
    path.should.be.a.String;
    next.should.be.an.instanceOf(Remutable);
  });
  if (this._stores[path] === void 0) {
    // we are no more interested, dismiss
    return;
  }
  var prev = this._stores[path];
  if (next.version <= prev.version) {
    // we already have an equally or more recent version
    return;
  }
  var diffPatch = Patch.fromDiff(prev, next);
  this.handleReceivePatch(path, diffPatch);
};

// A new patch is available, maybe we can update our version. If not, then
// we must update to a more recent version.
Engine.prototype.handleReceivePatch = function (path, patch) {
  var _this12 = this;
  _.dev(function () {
    path.should.be.a.String;
    patch.should.be.an.instanceOf(Remutable.Patch);
  });
  if (this._stores[path] === void 0) {
    // we are not interested, dismiss
    return;
  }
  var prev = this._stores[path];
  if (patch.to.v <= prev.version) {
    // we already have an equally or more recent version
    return;
  }
  _.dev(function () {
    return (_this12._patches[path] !== void 0).should.be.ok;
  });
  this._patches[path][patch.from.h] = patch;
  if (this.applyAllPatches(path) === 0) {
    // no patch applied means we are out of sync and we must refetch
    this.refetch(path, patch.to.v);
  }
};

Engine.prototype.maybeSubscribe = function (path) {
  var _this13 = this;
  if (this._remotelySubscribed[path] !== void 0) {
    _.dev(function () {
      return (_this13._stores[path] !== void 0).should.be.ok;
    });
    return this._stores[path];
  }
  if (this._subscribers[path] === void 0) {
    return;
  }
  if (this._pid !== null) {
    // connected and handshaked
    var message = Message.Subscribe({ path: path });
    this._socket.send(message);
    this._remotelySubscribed[path] = true;
  }
  this._stores[path] = new Remutable();
  this._patches[path] = {};
  this._refetching[path] = this.refetch(path);
  return this._stores[path];
};

Engine.prototype.maybeUnsubscribe = function (path) {
  if (this._remotelySubscribed[path] === void 0) {
    return;
  }
  if (this._subscribers[path] !== void 0) {
    return;
  }
  if (this._pid !== null) {
    var message = Message.Unsubscribe({ path: path });
    this._socket.send(message);
    delete this._remotelySubscribed[path];
  }
  if (this._refetching[path] && this._refetching[path].isPending()) {
    this._refetching[path].cancel(new Error("Unsubscribed from " + path));
  }
  this._stores[path].destroy();
  delete this._stores[path];
  delete this._refetching[path];
  delete this._patches[path];
};

Engine.prototype.refetch = function (path, version) {
  var _this14 = this;
  // refetch path, and require an equal or newer version (an even more recent version than expected can come back)
  _.dev(function () {
    path.should.be.a.String;
    version.should.be.a.Number;
    (_this14._stores[path] !== void 0).should.be.ok;
    (_this14._refetching[path] !== void 0).should.be.ok;
    (_this14._patches[path] !== void 0).should.be.ok;
  });
  if (this._refetching[path]) {
    // we are already refetching
    return;
  }
  _.dev(function () {
    return (_this14._requester !== null).should.be.ok;
  });
  this._refetching[path] = true;
  var u = url.parse(path, true);
  //_v?=${version} means that a version AT LEAST AS RECENT as version will be fetched (it can be newer)
  u.query._v = version;
  u.search = null; // erase u.search so that u.query is used by format
  u = url.format(u);
  // Since the version fetched will be >= version, we can delete outdated patches already
  this.clearOutdatedPatches(path, version);
  return this._requester.GET(u, { type: "json" })["catch"](function (err) {
    _.dev(function () {
      throw err;
    });
    _this14._refetching[path] = null;
  }).then(function (json) {
    _this14._refetching[path] = null;
    var remutable = Remutable.fromJSON(json);
    return _this14.handleReceiveRemutable(path, remutable);
  });
};

_prototypeProperties(Engine, null, {
  requester: {
    set: function (value) {
      _.dev(function () {
        value.should.be.an.instanceOf(Requester);
      });
      this._requester = value;
    },
    get: function () {
      var _this15 = this;
      _.dev(function () {
        return (_this15._requester !== null).should.be.ok;
      });
      return this._requester;
    },
    enumerable: true
  }
});




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
  _handshake: null });

_Engine = Engine;

module.exports = Engine;