"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = process.env.NODE_ENV !== "production";var __PROD__ = !__DEV__;var __BROWSER__ = typeof window === "object";var __NODE__ = !__BROWSER__;var _ = require("lodash-next");
var createEngineIOClient = require("engine.io-client");
var EventEmitter = require("events").EventEmitter;

var DEFAULT_HANDSHAKE_TIMEOUT = 5000;
var DEFAULT_RECONNECT_INTERVAL = 1000;
var DEFAULT_RECONNECT_BACKOFF = 1.5;

/**
 * This class only handles the low-level messages exchanges and handshakes.
 * Subscriptions & listeners bookkeeping is handled by the Uplink class.
 * Connection#events emits 'update', 'emit', and 'handshakeAck' events.
 */
var Connection = function Connection(_ref) {
  var url = _ref.url;
  var guid = _ref.guid;
  var handshakeTimeout = _ref.handshakeTimeout;
  var reconnectInterval = _ref.reconnectInterval;
  var reconnectBackoff = _ref.reconnectBackoff;
  _.dev(function () {
    return url.should.be.a.String && guid.should.be.a.String;
  });
  handshakeTimeout = handshakeTimeout || DEFAULT_HANDSHAKE_TIMEOUT;
  reconnectInterval = reconnectInterval || DEFAULT_RECONNECT_INTERVAL;
  reconnectBackoff = reconnectBackoff || DEFAULT_RECONNECT_BACKOFF;
  _.dev(function () {
    return handshakeTimeout.should.be.a.Number.and.not.be.below(0) && reconnectInterval.should.be.a.Number.and.not.be.below(0) && reconnectBackoff.should.be.a.Number.and.not.be.below(1);
  });
  _.extend(this, {
    url: url,
    guid: guid,
    handshakeTimeout: handshakeTimeout,
    reconnectInterval: reconnectInterval,
    reconnectBackoff: reconnectBackoff,
    _isDestroyed: false,
    _isConnected: false,
    events: new EventEmitter(),
    subscribedPaths: {},
    listenedRooms: {},
    _io: null });

  this.resetConnectionAttempts();
  this.reconnect();
};

Connection.prototype.destroy = function () {
  var _this = this;
  _.dev(function () {
    return _this.isDestroyed.should.not.be.ok;
  });
  this._isDestroyed = true;
  if (this._io !== null) {
    this._io.close();
  }
  if (this._connectionTimeout !== null) {
    clearTimeout(this._connectionTimeout);
    this._connectionTimeout = null;
  }
  if (this._handshakeTimeout !== null) {
    clearTimeout(this._handshakeTimeout);
    this._handshakeTimeout = null;
  }
  Object.keys(this.subscribedPaths).forEach(function (path) {
    delete _this.subscribedPaths[path];
  });
  this.subscribedPaths = null;
  Object.keys(this.listenedRooms).forEach(function (room) {
    delete _this.listenedRooms[room];
  });
  this.listenedRooms = null;
};

Connection.prototype.resetConnectionAttempts = function () {
  this._connectionAttempts = 0;
};

Connection.prototype.reconnect = function () {
  var _this2 = this;
  var delay = this._connectionAttempts === 0 ? 0 : this.reconnectInterval * Math.pow(this.reconnectBackoff, this._connectionAttempts - 1);
  _.dev(function () {
    return console.warn("nexus-uplink-client", "reconnect", { connectionAttempt: _this2._connectionAttempts, delay: delay });
  });
  this._connectionAttempts = this._connectionAttempts + 1;
  if (delay === 0) {
    return this.connect();
  } else {
    this._connectionTimeout = setTimeout(function () {
      return _this2.connect();
    }, delay);
  }
};

Connection.prototype.connect = function () {
  var _this3 = this;
  _.dev(function () {
    return console.warn("nexus-uplink-client", "connect");
  });
  _.dev(function () {
    return (_this3._io === null).should.be.ok && _this3.isConnected.should.not.be.ok && (_this3._connectionAttempts === 1 || _this3._connectionTimeout !== null).should.be.ok;
  });
  this._connectionTimeout = null;
  this._io = createEngineIOClient(this.url).on("open", function () {
    return _this3.handleIOOpen();
  }).on("close", function () {
    return _this3.handleIOClose();
  }).on("error", function (err) {
    return _this3.handleIOError(err);
  }).on("message", function (json) {
    return _this3.handleIOMessage(json);
  });
};

Connection.prototype.handleIOOpen = function () {
  var _this4 = this;
  _.dev(function () {
    return console.warn("nexus-uplink-client", "open");
  });
  _.dev(function () {
    return _this4.isConnected.should.not.be.ok;
  });
  this.handshake();
};

Connection.prototype.handleIOClose = function () {
  _.dev(function () {
    return console.warn("nexus-uplink-client", "close");
  });
  if (!this.isDestroyed) {
    this._isConnected = false;
    this._io.off("open").off("close").off("error").off("message");
    this._io = null;
    this.reconnect();
  }
};

Connection.prototype.handleIOError = function (err) {
  _.dev(function () {
    return console.warn("nexus-uplink-client", "error", err);
  });
  if (!this.isConnected && !this.isDestroyed) {
    this._io.off("open").off("close").off("error").off("message");
    this._io = null;
    this.reconnect();
  }
};

Connection.prototype.handleIOMessage = function (json) {
  _.dev(function () {
    return console.warn("nexus-uplink-client", "<<", json);
  });
  var _ref2 = JSON.parse(json);

  var event = _ref2.event;
  var params = _ref2.params;
  _.dev(function () {
    return (event !== void 0).should.be.ok && (params !== void 0).should.be.ok && event.should.be.a.String && (params === null || _.isObject(params)).should.be.ok;
  });
  if (event === "handshakeAck") {
    return this.handleMessageHandshakeAck(params);
  }
  if (event === "update") {
    return this.handleMessageUpdate(params);
  }
  if (event === "emit") {
    return this.handleMessageEmit(params);
  }
  if (event === "debug") {
    return this.handleMessageDebug(params);
  }
  if (event === "log") {
    return this.handleMessageLog(params);
  }
  if (event === "warn") {
    return this.handleMessageWarn(params);
  }
  if (event === "err") {
    return this.handleMessageErr(params);
  }
  throw new Error("nexus-uplink-client Unrecognized message received " + event + " " + JSON.stringify(params, null, 2));
};

Connection.prototype.handleMessageHandshakeAck = function (_ref3) {
  var _this5 = this;
  var pid = _ref3.pid;
  if (this.isConnected) {
    _.dev(function () {
      return console.warn("nexus-uplink-client", "handshakeAck received while already connected");
    });
    return;
  }
  clearTimeout(this._handshakeTimeout);
  this._isConnected = true;
  this.events.emit("handshakeAck", { pid: pid });
  Object.keys(this.subscribedPaths).forEach(function (path) {
    return _this5.remoteSubscribeTo(path);
  });
  Object.keys(this.listenedRooms).forEach(function (room) {
    return _this5.remoteListenTo(room);
  });
  this.resetConnectionAttempts();
};

Connection.prototype.handleMessageUpdate = function (_ref4) {
  var path = _ref4.path;
  var diff = _ref4.diff;
  var prevVersion = _ref4.prevVersion;
  var nextVersion = _ref4.nextVersion;
  _.dev(function () {
    return path.should.be.a.String && diff.should.be.an.Object && prevVersion.should.be.a.Number && nextVersion.should.be.a.Number;
  });
  this.events.emit("update", { path: path, diff: diff, prevVersion: prevVersion, nextVersion: nextVersion });
};

Connection.prototype.handleMessageEmit = function (_ref5) {
  var room = _ref5.room;
  var params = _ref5.params;
  _.dev(function () {
    return room.should.be.a.String && (params === null || _.isObject(params)).should.be.ok;
  });
  this.events.emit("emit", { room: room, params: params });
};

Connection.prototype.handleMessageDebug = function (params) {
  _.dev(function () {
    return console.warn(params);
  });
};

Connection.prototype.handleMessageLog = function (params) {
  console.log(params);
};

Connection.prototype.handleMessageWarn = function (params) {
  console.warn(params);
};

Connection.prototype.handleMessageErr = function (params) {
  console.error(params);
};

Connection.prototype.handleHandshakeTimeout = function () {
  _.dev(function () {
    return console.warn("nexus-uplink-client", "handshakeTimeout");
  });
  // Will implicitly call this.reconnect() in this.handleIOClose().
  this._io.close();
};

Connection.prototype.remoteSend = function (event, params) {
  var _this6 = this;
  _.dev(function () {
    return console.warn("nexus-uplink-client", ">>", event, params);
  });
  _.dev(function () {
    return (_this6._io !== null).should.be.ok && event.should.be.a.String && (params === null || _.isObject(params)).should.be.ok;
  });
  this._io.send(JSON.stringify({ event: event, params: params }));
};

Connection.prototype.remoteHandshake = function () {
  this.remoteSend("handshake", { guid: this.guid });
};

Connection.prototype.remoteSubscribeTo = function (path) {
  _.dev(function () {
    return path.should.be.a.String;
  });
  this.remoteSend("subscribeTo", { path: path });
};

Connection.prototype.remoteUnsubscribeFrom = function (path) {
  _.dev(function () {
    return path.should.be.a.String;
  });
  this.remoteSend("unsubscribeFrom", { path: path });
};

Connection.prototype.remoteListenTo = function (room) {
  _.dev(function () {
    return room.should.be.a.String;
  });
  this.remoteSend("remoteListenTo", { room: room });
};

Connection.prototype.remoteUnlistenFrom = function (room) {
  _.dev(function () {
    return room.should.be.a.String;
  });
  this.remoteSend("remoteUnlistenFrom", { room: room });
};

Connection.prototype.handshake = function () {
  var _this7 = this;
  _.dev(function () {
    return _this7.isConnected.should.not.be.ok && (_this7._handshakeTimeout === null).should.be.ok;
  });
  this._handshakeTimeout = setTimeout(function () {
    return _this7.handleHandshakeTimeout();
  }, this.handshakeTimeout);
  this.remoteHandshake();
};

Connection.prototype.subscribeTo = function (path) {
  _.dev(function () {
    return path.should.be.a.String;
  });
  if (this.subscribedPaths[path] === void 0) {
    this.subscribedPaths[path] = 0;
    if (this.isConnected) {
      this.remoteSubscribeTo(path);
    }
  }
  this.subscribedPaths[path] = this.subscribedPaths[path] + 1;
};

Connection.prototype.unsubscribeFrom = function (path) {
  var _this8 = this;
  _.dev(function () {
    return path.should.be.a.String;
  });
  _.dev(function () {
    return (_this8.subscribedPaths[path] !== void 0).should.be.ok && _this8.subscribedPaths[path].should.be.a.Number.and.be.above(0);
  });
  this.subscribedPaths[path] = this.subscribedPaths[path] - 1;
  if (this.subscribedPaths[path] === 0) {
    delete this.subscribedPaths[path];
    if (this.isConnected) {
      this.remoteUnsubscribeFrom(path);
    }
  }
};

Connection.prototype.listenTo = function (room) {
  _.dev(function () {
    return room.should.be.a.String;
  });
  if (this.listenedRooms[room] === void 0) {
    this.listenedRooms[room] = 0;
    if (this.isConnected) {
      this.remoteListenTo(room);
    }
  }
  this.listenedRooms[room] = this.listenedRooms[room] + 1;
};

Connection.prototype.unlistenFrom = function (room) {
  var _this9 = this;
  _.dev(function () {
    return room.should.be.a.String;
  });
  _.dev(function () {
    return (_this9.listenedRooms[room] !== void 0).should.be.ok && _this9.listenedRooms[room].should.be.a.Number.and.be.above(0);
  });
  this.listenedRooms[room] = this.listenedRooms[room] - 1;
  if (this.listenedRooms[room] === 0) {
    delete this.listenedRooms[room];
    if (this.isConnected) {
      this.remoteUnlistenFrom(room);
    }
  }
};

_prototypeProperties(Connection, null, {
  isDestroyed: {
    get: function () {
      return !!this._isDestroyed;
    },
    enumerable: true
  },
  isConnected: {
    get: function () {
      return !!this._isConnected;
    },
    enumerable: true
  }
});

_.extend(Connection.prototype, {
  _destroyed: null,
  _io: null,
  url: null,
  guid: null,
  handshakeTimeout: null,
  reconnectInterval: null,
  reconnectBackoff: null,
  events: null,
  subscribedPaths: null,
  listenedRooms: null,
  _connectionTimeout: null,
  _connectionAttempts: null,
  _handshakeTimeout: null,
  _isConnected: null });

module.exports = Connection;