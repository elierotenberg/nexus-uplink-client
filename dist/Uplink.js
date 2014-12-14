"use strict";

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = (process.env.NODE_ENV !== "production");var __PROD__ = !__DEV__;var __BROWSER__ = (typeof window === "object");var __NODE__ = !__BROWSER__;var _ = require("lodash-next");
var relative = require("url").resolve;

var Requester = require("./Requester");
var Connection = require("./Connection");
var Listener = require("./Listener");
var Subscription = require("./Subscription");

var Uplink = (function () {
  var Uplink = function Uplink(_ref) {
    var _this = this;
    var url = _ref.url;
    var guid = _ref.guid;
    var requestTimeout = _ref.requestTimeout;
    var handshakeTimeout = _ref.handshakeTimeout;
    var reconnectInterval = _ref.reconnectInterval;
    var reconnectBackoff = _ref.reconnectBackoff;
    var shouldReloadOnServerRestart = _ref.shouldReloadOnServerRestart;
    var _shouldReloadOnServerRestart = (shouldReloadOnServerRestart === void 0) ? true : !!shouldReloadOnServerRestart;
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
    this._connection.events.on("update", function (_ref2) {
      var path = _ref2.path;
      var diff = _ref2.diff;
      var hash = _ref2.hash;
      return _this._handleUpdate({ path: path, diff: diff, hash: hash });
    });
    this._connection.events.on("emit", function (_ref3) {
      var room = _ref3.room;
      var params = _ref3.params;
      return _this._handleEmit({ room: room, params: params });
    });
    this._connection.events.on("handshakeAck", function (_ref4) {
      var pid = _ref4.pid;
      return _this._handleHanshakeAck({ pid: pid });
    });
  };

  Uplink.prototype.destroy = function () {
    var _this2 = this;
    // Cancel all pending requests/active subscriptions/listeners
    Object.keys(this.subscriptions).forEach(function (path) {
      return Object.keys(_this2.subscriptions[path]).forEach(function (id) {
        return _this2.unsubscribeFrom(_this2.subscriptions[path][id]);
      });
    });
    Object.keys(this.listeners).forEach(function (room) {
      return Object.keys(_this2.listeners[room]).forEach(function (id) {
        return _this2.unlistenFrom(_this2.listeners[room][id]);
      });
    });
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
      return this._refresh(path);
    }
  };

  Uplink.prototype.dispatch = function (action, params) {
    _.dev(function () {
      return action.should.be.a.String && params.should.be.an.Object;
    });
    return this._requester.post(relative(this.url, action), _.extend({}, params, { guid: this.guid }));
  };

  Uplink.prototype.subscribeTo = function (path, handler) {
    _.dev(function () {
      return path.should.be.a.String && handler.should.be.a.Function;
    });
    var subscription = new Subscription({ path: path, handler: handler });
    var createdPath = subscription.addTo(this._subscriptions);
    if (createdPath) {
      this._connection.subscribeTo(path);
    }
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
      this._connection.abort(relative(this.url, path));
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

  Uplink.prototype._handleUpdate = function (_ref5) {
    var _this3 = this;
    var path = _ref5.path;
    var diff = _ref5.diff;
    var hash = _ref5.hash;
    if (this._subscriptions[path] === void 0) {
      _.dev(function () {
        return console.warn("nexus-uplink-client", "update for path " + path + " without matching subscription");
      });
      return;
    }
    _.dev(function () {
      return (_this3._storeCache[path] !== void 0).should.be.ok;
    });
    if (this._storeCache[path].hash === hash) {
      return this._set(path, _.patch(this._storeCache[path].value, diff), Date.now());
    }
    return this._refresh(path);
  };

  Uplink.prototype._handleEmit = function (_ref6) {
    var room = _ref6.room;
    var params = _ref6.params;
    if (this.listeners[room] === void 0) {
      _.dev(function () {
        return console.warn("nexus-uplink-client", "emit for room " + room + " without matching listener");
      });
      return;
    }
    return this._propagateEmit(room, params);
  };

  Uplink.prototype._handleHanshakeAck = function (_ref7) {
    var _this4 = this;
    var pid = _ref7.pid;
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

  Uplink.prototype._refresh = function (path) {
    var _this5 = this;
    _.dev(function () {
      return path.should.be.a.String;
    });
    var tick = Date.now();
    return this._requester.get(relative(this.url, path)).then(function (value) {
      return _this5._set(path, value, tick);
    });
  };

  Uplink.prototype._set = function (path, value, tick) {
    _.dev(function () {
      return path.should.be.a.String && (value === null || _.isObject(value)).should.be.ok && tick.should.be.a.Number.and.be.above(0);
    });
    // Only update if there was no previous version or an older version
    if (this._storeCache[path] === void 0 || this._storeCache[path].tick < tick) {
      this._storeCache[path] = { value: value, hash: _.hash(value), tick: tick };
      this._propagateUpdate(path, value);
    }
    return this._storeCache[path].value;
  };

  Uplink.prototype._propagateUpdate = function (path, value) {
    var _this6 = this;
    _.dev(function () {
      return path.should.be.a.String && (value === null || _.isObject(value)).should.be.ok;
    });
    if (this._subscriptions[path] !== void 0) {
      Object.keys(this._subscriptions[path]).forEach(function (k) {
        return _this6._subscriptions[path][k].update(value);
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