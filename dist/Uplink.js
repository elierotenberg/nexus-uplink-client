"use strict";

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = (process.env.NODE_ENV !== "production");var __PROD__ = !__DEV__;var __BROWSER__ = (typeof window === "object");var __NODE__ = !__BROWSER__;var _ = require("lodash-next");
var _ref = require("url");

var parse = _ref.parse;
var format = _ref.format;
var resolve = _ref.resolve;


var Requester = require("./Requester");
var Connection = require("./Connection");
var Listener = require("./Listener");
var Subscription = require("./Subscription");

var Uplink = (function () {
  var Uplink = function Uplink(_ref2) {
    var _this = this;
    var url = _ref2.url;
    var guid = _ref2.guid;
    var requestTimeout = _ref2.requestTimeout;
    var handshakeTimeout = _ref2.handshakeTimeout;
    var reconnectInterval = _ref2.reconnectInterval;
    var reconnectBackoff = _ref2.reconnectBackoff;
    var shouldReloadOnServerRestart = _ref2.shouldReloadOnServerRestart;
    var _shouldReloadOnServerRestart = (shouldReloadOnServerRestart === void 0) ? true : !!shouldReloadOnServerRestart;
    guid = (guid === void 0) ? _.guid() : guid;
    _.dev(function () {
      return url.should.be.a.String && guid.should.be.a.String && _shouldReloadOnServerRestart.should.be.a.Boolean;
    });
    _.extend(this, {
      url: url,
      guid: guid,
      _shouldReloadOnServerRestart: _shouldReloadOnServerRestart,
      _listeners: {},
      _subscriptions: {},
      _storeCache: {},
      _connection: new Connection({ url: url, guid: guid, handshakeTimeout: handshakeTimeout, reconnectInterval: reconnectInterval, reconnectBackoff: reconnectBackoff }),
      _requester: new Requester({ requestTimeout: requestTimeout }) });
    this._connection.events.on("update", function (_ref3) {
      var path = _ref3.path;
      var diff = _ref3.diff;
      var prevVersion = _ref3.prevVersion;
      var nextVersion = _ref3.nextVersion;
      return _this._handleUpdate({ path: path, diff: diff, prevVersion: prevVersion, nextVersion: nextVersion });
    });
    this._connection.events.on("emit", function (_ref4) {
      var room = _ref4.room;
      var params = _ref4.params;
      return _this._handleEmit({ room: room, params: params });
    });
    this._connection.events.on("handshakeAck", function (_ref5) {
      var pid = _ref5.pid;
      return _this._handleHanshakeAck({ pid: pid });
    });
  };

  Uplink.prototype.destroy = function () {
    var _this2 = this;
    // Cancel all pending requests/active subscriptions/listeners
    Object.keys(this._subscriptions).forEach(function (path) {
      return Object.keys(_this2._subscriptions[path]).forEach(function (id) {
        return _this2.unsubscribeFrom(_this2._subscriptions[path][id]);
      });
    });
    this._subscriptions = null;
    Object.keys(this._listeners).forEach(function (room) {
      return Object.keys(_this2._listeners[room]).forEach(function (id) {
        return _this2.unlistenFrom(_this2._listeners[room][id]);
      });
    });
    this._listeners = null;
    Object.keys(this._storeCache).forEach(function (path) {
      return delete _this2._storeCache[path];
    });
    this._storeCache = null;
    this._connection.destroy();
    this._requester.destroy();
  };

  Uplink.prototype.pull = function (path) {
    _.dev(function () {
      return path.should.be.a.String;
    });
    if (this._storeCache[path]) {
      return Promise.resolve(this._storeCache[path].value);
    } else {
      return this._refresh(path, null);
    }
  };

  Uplink.prototype.dispatch = function (action, params) {
    _.dev(function () {
      return action.should.be.a.String && params.should.be.an.Object;
    });
    return this._requester.post(resolve(this.url, action), _.extend({}, params, { guid: this.guid }));
  };

  Uplink.prototype.subscribeTo = function (path, handler) {
    var _this3 = this;
    _.dev(function () {
      return path.should.be.a.String && handler.should.be.a.Function;
    });
    var subscription = new Subscription({ path: path, handler: handler });
    var createdPath = subscription.addTo(this._subscriptions);
    if (createdPath) {
      this._connection.subscribeTo(path);
    }
    // Immediatly attempt to pull to sync the cache
    this.pull(path).then(function (value) {
      return subscription.update(value, _this3._storeCache[path].version);
    });
    return { subscription: subscription, createdPath: createdPath };
  };

  Uplink.prototype.unsubscribeFrom = function (subscription) {
    _.dev(function () {
      return subscription.should.be.an.instanceOf(Subscription);
    });
    var path = { subscription: subscription };
    var deletedPath = subscription.removeFrom(this._subscriptions);
    this._connection.unsubscribeFrom(path);
    if (deletedPath) {
      this._connection.abort(resolve(this.url, path));
      delete this._storeCache[path];
      this._connection.unsubscribeFrom(path);
    }
    return { subscription: subscription, deletedPath: deletedPath };
  };

  Uplink.prototype.listenTo = function (room, handler) {
    _.dev(function () {
      return room.should.be.a.String && handler.should.be.a.Function;
    });
    var listener = new Listener({ room: room, handler: handler });
    var createdRoom = listener.addTo(this._listeners);
    if (createdRoom) {
      this._connection.listenTo(room);
    }
    return { listener: listener, createdRoom: createdRoom };
  };

  Uplink.prototype.unlistenFrom = function (listener) {
    _.dev(function () {
      return listener.should.be.an.instanceOf(Listener);
    });
    var room = listener.room;
    var deletedRoom = listener.removeFrom(this._listeners);
    if (deletedRoom) {
      this._connection.unlistenFrom(room);
    }
    return { listener: listener, deletedRoom: deletedRoom };
  };

  Uplink.prototype._handleUpdate = function (_ref6) {
    var path = _ref6.path;
    var diff = _ref6.diff;
    var prevVersion = _ref6.prevVersion;
    var nextVersion = _ref6.nextVersion;
    _.dev(function () {
      return path.should.be.a.String && diff.should.be.an.Object && prevVersion.should.be.a.Number && nextVersion.should.be.a.Number;
    });
    if (this._subscriptions[path] === void 0) {
      _.dev(function () {
        return console.warn("nexus-uplink-client", "update for path " + path + " without matching subscription");
      });
      return;
    }
    if (this._storeCache[path] !== void 0 && this._storeCache[path].version === prevVersion) {
      return this._set(path, _.patch(this._storeCache[path].value, diff), nextVersion);
    }
    return this._refresh(path, nextVersion);
  };

  Uplink.prototype._handleEmit = function (_ref7) {
    var room = _ref7.room;
    var params = _ref7.params;
    if (this.listeners[room] === void 0) {
      _.dev(function () {
        return console.warn("nexus-uplink-client", "emit for room " + room + " without matching listener");
      });
      return;
    }
    return this._propagateEmit(room, params);
  };

  Uplink.prototype._handleHanshakeAck = function (_ref8) {
    var _this4 = this;
    var pid = _ref8.pid;
    _.dev(function () {
      return pid.should.be.a.String;
    });
    if (this.pid === null) {
      this.pid = pid;
    } else if (this.pid !== pid) {
      _.dev(function () {
        return console.warn("nexus-uplink-client", "handshakeAck with new pid", pid, _this4.pid);
      });
      if (this._shouldReloadOnServerRestart && __BROWSER__) {
        window.location.reload(true);
      }
    }
  };

  Uplink.prototype._refresh = function (path, version) {
    var _this5 = this;
    _.dev(function () {
      return path.should.be.a.String;
    });
    var url = parse(resolve(this.url, path), true);
    url.query = url.query || {};
    if (version !== void 0) {
      url.query.v = version;
    }
    return this._requester.get(format(url)).then(function (value) {
      return _this5._set(path, value, version);
    });
  };

  Uplink.prototype._set = function (path, value, version) {
    _.dev(function () {
      return path.should.be.a.String && (value === null || _.isObject(value)).should.be.ok && version.should.be.a.Number.and.be.above(0);
    });
    // Only update if there was no previous version or an older version
    if (this._storeCache[path] === void 0 || this._storeCache[path].version < version) {
      this._storeCache[path] = { value: value, version: version };
      this._propagateUpdate(path, value, version);
    }
    return this._storeCache[path].value;
  };

  Uplink.prototype._propagateUpdate = function (path, value, version) {
    var _this6 = this;
    _.dev(function () {
      return path.should.be.a.String && (value === null || _.isObject(value)).should.be.ok;
    });
    if (this._subscriptions[path] !== void 0) {
      Object.keys(this._subscriptions[path]).forEach(function (k) {
        return _this6._subscriptions[path][k].update(value, version);
      });
    }
  };

  Uplink.prototype._propagateEmit = function (room, params) {
    var _this7 = this;
    _.dev(function () {
      return room.should.be.a.String && (params === null) || _.isObject(params).should.be.ok;
    });
    if (this._listeners[room]) {
      Object.keys(this._listeners[room]).forEach(function (k) {
        return _this7._listeners[room][k].emit(params);
      });
    }
  };

  return Uplink;
})();

_.extend(Uplink.prototype, {
  url: null,
  guid: null,
  pid: null,
  _subscriptions: null,
  _storeCache: null,
  _listeners: null,
  _connection: null,
  _requester: null });

module.exports = Uplink;