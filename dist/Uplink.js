"use strict";

var _slice = Array.prototype.slice;
var _toArray = function (arr) {
  return Array.isArray(arr) ? arr : Array.from(arr);
};

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = (process.env.NODE_ENV !== "production");var __PROD__ = !__DEV__;var __BROWSER__ = (typeof window === "object");var __NODE__ = !__BROWSER__;var _ = require("lodash-next");

var io = require("socket.io-client");
var relative = require("url").resolve;
var request = require("request");

var Listener = require("./Listener");
var Subscription = require("./Subscription");

var HANDSHAKE_TIMEOUT = 5000;

// These socket.io handlers are actually called like Uplink instance method
// (using .call). In their body 'this' is therefore an Uplink instance.
// They are declared here to avoid cluttering the Uplink class definition
// and method naming collisions.
var ioHandlers = _.mapValues({
  connect: regeneratorRuntime.mark(function _callee() {
    var _this = this;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (true) switch (_context.prev = _context.next) {
        case 0:
          _this.push("handshake", { guid: _this.guid });
        case 1:
        case "end": return _context.stop();
      }
    }, _callee, this);
  }),

  reconnect: regeneratorRuntime.mark(function _callee2() {
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (true) switch (_context2.prev = _context2.next) {
        case 0:
        case "end": return _context2.stop();
      }
    }, _callee2, this);
  }),

  disconnect: regeneratorRuntime.mark(function _callee3() {
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (true) switch (_context3.prev = _context3.next) {
        case 0:
        case "end": return _context3.stop();
      }
    }, _callee3, this);
  }),

  handshakeAck: regeneratorRuntime.mark(function _callee4(_ref) {
    var _this2 = this;
    var pid;
    return regeneratorRuntime.wrap(function _callee4$(_context4) {
      while (true) switch (_context4.prev = _context4.next) {
        case 0: pid = _ref.pid;
          if (_this2.pid !== null && pid !== _this2.pid && _this2.shouldReloadOnServerRestart && (__BROWSER__)) {
            window.location.reload();
          }
          _this2.pid = pid;
          _this2._handshake.resolve({ pid: pid });
        case 4:
        case "end": return _context4.stop();
      }
    }, _callee4, this);
  }),

  update: regeneratorRuntime.mark(function _callee5(_ref2) {
    var _this3 = this;
    var path, diff, hash, tick;
    return regeneratorRuntime.wrap(function _callee5$(_context5) {
      while (true) switch (_context5.prev = _context5.next) {
        case 0: path = _ref2.path;
          diff = _ref2.diff;
          hash = _ref2.hash;
          // At the uplink level, updates are transmitted
          // as (diff, hash). If the uplink client has
          // a cached value with the matching hash, then
          // the diff is applied. If not, then the full value
          // is fetched.
          _.dev(function () {
            return path.should.be.a.String;
          });
          if (_this3.subscriptions[path]) {
            _context5.next = 6;
            break;
          }
          return _context5.abrupt("return");
        case 6:
          if (!_this3.store[path]) {
            _this3.store[path] = { hash: null, value: void 0, tick: -1 };
          }
          tick = _this3._tick;
          _this3._tick = _this3._tick + 1;
          if (!(_this3.store[path].hash === hash)) {
            _context5.next = 13;
            break;
          }
          return _context5.abrupt("return", _this3.update({ path: path, value: _.patch(_this3.store[path], diff), tick: tick }));
        case 13: _context5.next = 15;
          return _this3.pull(path, { bypassCache: true });
        case 15: _context5.t0 = _context5.sent;
          return _context5.abrupt("return", _this3.update({
            path: path,
            value: _context5.t0,
            tick: tick
          }));
        case 17:
        case "end": return _context5.stop();
      }
    }, _callee5, this);
  }),

  emit: regeneratorRuntime.mark(function _callee6(_ref3) {
    var _this4 = this;
    var room, params;
    return regeneratorRuntime.wrap(function _callee6$(_context6) {
      while (true) switch (_context6.prev = _context6.next) {
        case 0: room = _ref3.room;
          params = _ref3.params;
          _.dev(function () {
            return room.should.be.a.String && params.should.be.an.Object;
          });
          _this4.emit(room, params);
        case 4:
        case "end": return _context6.stop();
      }
    }, _callee6, this);
  }),

  debug: regeneratorRuntime.mark(function _callee7() {
    var args;
    return regeneratorRuntime.wrap(function _callee7$(_context7) {
      while (true) switch (_context7.prev = _context7.next) {
        case 0: args = _slice.call(arguments);
          console.table.apply(console, _toArray(args));
        case 2:
        case "end": return _context7.stop();
      }
    }, _callee7, this);
  }),

  log: regeneratorRuntime.mark(function _callee8() {
    var args;
    return regeneratorRuntime.wrap(function _callee8$(_context8) {
      while (true) switch (_context8.prev = _context8.next) {
        case 0: args = _slice.call(arguments);
          console.log.apply(console, _toArray(args));
        case 2:
        case "end": return _context8.stop();
      }
    }, _callee8, this);
  }),

  warn: regeneratorRuntime.mark(function _callee9() {
    var args;
    return regeneratorRuntime.wrap(function _callee9$(_context9) {
      while (true) switch (_context9.prev = _context9.next) {
        case 0: args = _slice.call(arguments);
          console.warn.apply(console, _toArray(args));
        case 2:
        case "end": return _context9.stop();
      }
    }, _callee9, this);
  }),

  err: regeneratorRuntime.mark(function _callee10() {
    var args;
    return regeneratorRuntime.wrap(function _callee10$(_context10) {
      while (true) switch (_context10.prev = _context10.next) {
        case 0: args = _slice.call(arguments);
          console.error.apply(console, _toArray(args));
        case 2:
        case "end": return _context10.stop();
      }
    }, _callee10, this);
  }) }, _.co.wrap);

var Uplink = (function () {
  var Uplink = function Uplink(_ref4) {
    var _this5 = this;
    var url = _ref4.url;
    var guid = _ref4.guid;
    var shouldReloadOnServerRestart = _ref4.shouldReloadOnServerRestart;
    shouldReloadOnServerRestart = (shouldReloadOnServerRestart === void 0) ? true : !!shouldReloadOnServerRestart;
    _.dev(function () {
      return url.should.be.a.String && guid.should.be.a.String && shouldReloadOnServerRestart.should.be.a.Boolean;
    });
    this.http = url;
    this._tick = 0; // internal ticker to avoid overwriting fresher data
    _.dev(function () {
      return console.warn("nexus-uplink-client", ">>", "connect", { url: url });
    });
    this.io = io(url);
    this.pid = null;
    this.guid = guid;
    this.shouldReloadOnServerRestart = shouldReloadOnServerRestart;
    this.handshake = new Promise(function (resolve, reject) {
      return _this5._handshake = { resolve: resolve, reject: reject };
    }).timeout(HANDSHAKE_TIMEOUT, "Handshake timeout expired.").cancellable();
    this.listeners = {};
    this.subscriptions = {};
    this.store = {};
    this.pending = {};
    this.bindIOHandlers();
  };

  Uplink.prototype.destroy = function () {
    var _this6 = this;
    // Cancel all pending requests/active subscriptions/listeners
    if (!this.pid) {
      this.handshake.cancel();
    }
    Object.keys(this.subscriptions).forEach(function (path) {
      return Object.keys(_this6.subscriptions[path]).forEach(function (id) {
        return _this6.unsubscribeFrom(_this6.subscriptions[path][id]);
      });
    });
    Object.keys(this.listeners).forEach(function (room) {
      return Object.keys(_this6.listeners[room]).forEach(function (id) {
        return _this6.unlistenFrom(_this6.listeners[room][id]);
      });
    });
    Object.keys(this.pending).forEach(function (path) {
      _this6.pending[path].cancel();
      delete _this6.pending[path];
    });
    this.io.close();
  };

  Uplink.prototype.bindIOHandlers = function () {
    var _this7 = this;
    Object.keys(ioHandlers).forEach(function (event) {
      return _this7.io.on(event, function (params) {
        _.dev(function () {
          return console.warn("nexus-uplink-client", "<<", event, params);
        });
        ioHandlers[event].call(_this7, _.prollyparse(params))["catch"](function (e) {
          return _.dev(function () {
            throw e;
          });
        });
      });
    });
  };

  Uplink.prototype.push = function (event, params) {
    _.dev(function () {
      return console.warn("nexus-uplink-client", ">>", event, params);
    });
    this.io.emit(event, params);
    return this;
  };

  Uplink.prototype.pull = function (path, opts) {
    var _this8 = this;
    if (opts === undefined) opts = {};
    var bypassCache = opts.bypassCache;
    _.dev(function () {
      return path.should.be.a.String;
    });
    if (!this.pending[path] || bypassCache) {
      this.pending[path] = this.fetch(path).cancellable().then(function (value) {
        // As soon as the result is received, removed from the pending list.
        delete _this8.pending[path];
        return value;
      });
    }
    _.dev(function () {
      return _this8.pending[path].then.should.be.a.Function;
    });
    return this.pending[path];
  };

  Uplink.prototype.fetch = function (path) {
    var _this9 = this;
    return new Promise(function (resolve, reject) {
      return request({ method: "GET", url: relative(_this9.http, path), json: true }, function (err, res, body) {
        return err ? reject(err) : resolve(body);
      });
    });
  };

  Uplink.prototype.dispatch = function (action, params) {
    var _this10 = this;
    _.dev(function () {
      return action.should.be.a.String && params.should.be.an.Object;
    });
    return new Promise(function (resolve, reject) {
      return request({ method: "POST", url: relative(_this10.http, action), json: true, body: _.extend({}, params, { guid: _this10.guid }) }, function (err, res, body) {
        return err ? reject(err) : resolve(body);
      });
    });
  };

  Uplink.prototype._remoteSubscribeTo = function (path) {
    _.dev(function () {
      return path.should.be.a.String;
    });
    this.store[path] = { value: null, hash: null };
    this.io.emit("subscribeTo", { path: path });
  };

  Uplink.prototype._remoteUnsubscribeFrom = function (path) {
    _.dev(function () {
      return path.should.be.a.String;
    });
    this.io.emit("unsubscribeFrom", { path: path });
    delete this.store[path];
  };

  Uplink.prototype.subscribeTo = function (path, handler) {
    _.dev(function () {
      return path.should.be.a.String && handler.should.be.a.Function;
    });
    var subscription = new Subscription({ path: path, handler: handler });
    var createdPath = subscription.addTo(this.subscriptions);
    if (createdPath) {
      this._remoteSubscribeTo(path);
    }
    return { subscription: subscription, createdPath: createdPath };
  };

  Uplink.prototype.unsubscribeFrom = function (subscription) {
    _.dev(function () {
      return subscription.should.be.an.instanceOf(Subscription);
    });
    var deletedPath = subscription.removeFrom(this.subscriptions);
    if (deletedPath) {
      this._remoteUnsubscribeFrom(subscription.path);
      delete this.store[subscription.path];
    }
    return { subscription: subscription, deletedPath: deletedPath };
  };

  Uplink.prototype.update = function (_ref5) {
    var _this11 = this;
    var path = _ref5.path;
    var value = _ref5.value;
    var tick = _ref5.tick;
    _.dev(function () {
      return path.should.be.a.String && (value === null || _.isObject(value)).should.be.ok && (_this11.store[path] !== void 0).should.be.ok;
    });
    if (!this.subscriptions[path]) {
      return;
    }
    if (this.store[path].tick > tick) {
      // A fresher version is already available
      return;
    }
    this.store[path] = { value: value, hash: _.hash(value), tick: tick };
    Object.keys(this.subscriptions[path]).forEach(function (key) {
      return _this11.subscriptions[path][key].update(value);
    });
  };

  Uplink.prototype._remoteListenTo = function (room) {
    _.dev(function () {
      return room.should.be.a.String;
    });
    this.io.emit("listenTo", { room: room });
  };

  Uplink.prototype._remoteUnlistenFrom = function (room) {
    _.dev(function () {
      return room.should.be.a.String;
    });
    this.io.emit("unlistenFrom", { room: room });
  };

  Uplink.prototype.listenTo = function (room, handler) {
    _.dev(function () {
      return room.should.be.a.String && handler.should.be.a.Function;
    });
    var listener = new Listener({ room: room, handler: handler });
    var createdRoom = listener.addTo(this.listeners);
    if (createdRoom) {
      this._remoteListenTo(room);
    }
    return { listener: listener, createdRoom: createdRoom };
  };

  Uplink.prototype.unlistenFrom = function (listener) {
    _.dev(function () {
      return listener.should.be.an.instanceOf(Listener);
    });
    var deletedRoom = listener.removeFrom(this.listeners);
    if (deletedRoom) {
      this._remoteUnlistenFrom(listener.room);
    }
    return { listener: listener, deletedRoom: deletedRoom };
  };

  Uplink.prototype.emit = function (room, params) {
    var _this12 = this;
    _.dev(function () {
      return room.should.be.a.String && params.should.be.an.Object;
    });
    if (this.listeners[room]) {
      Object.keys(this.listeners[room]).forEach(function (key) {
        return _this12.listeners[room][key].emit(params);
      });
    }
  };

  return Uplink;
})();

_.extend(Uplink.prototype, {
  guid: null,
  _tick: null,
  handshake: null,
  _handshake: null,
  io: null,
  pid: null,
  listeners: null,
  shouldReloadOnServerRestart: null,
  subscriptions: null,
  store: null });

module.exports = Uplink;