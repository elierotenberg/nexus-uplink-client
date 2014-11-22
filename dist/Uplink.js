"use strict";

var _slice = Array.prototype.slice;
var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = require("bluebird");var __DEV__ = (process.env.NODE_ENV !== "production");
var _ = require("lodash-next");

var io = require("socket.io-client");
var relative = require("url").resolve;
var request = _.isServer() ? require("request") : require("browser-request");

var Listener = require("./Listener");
var Subscription = require("./Subscription");

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
          if (_this2.pid !== null && pid !== _this2.pid && _this2.shouldReloadOnServerRestart && _.isClient()) {
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
    var path, diff, hash, value;
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
          if (_this3.store[path]) {
            _context5.next = 6;
            break;
          }
          return _context5.abrupt("return");
        case 6:
          if (!(_this3.store[path].hash === hash)) {
            _context5.next = 12;
            break;
          }
          _this3.store[path].value = _.patch(_this3.store[path], diff);
          _this3.store[path].hash = _.hash(_this3.store[path].value);
          _this3.update(path, _this3.store[path]);
          _context5.next = 17;
          break;
        case 12: _context5.next = 14;
          return _this3.pull(path, { bypassCache: true });
        case 14: value = _context5.sent;
          _this3.store[path] = { value: value, hash: _.hash(value) };
          _this3.update(path, _this3.store[path]);
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
          console.table.apply(console, Array.from(args));
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
          console.log.apply(console, Array.from(args));
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
          console.warn.apply(console, Array.from(args));
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
          console.error.apply(console, Array.from(args));
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
    _.dev(function () {
      return url.should.be.a.String && guid.should.be.a.String;
    });
    this.http = url;
    this.io = io(url);
    this.pid = null;
    this.guid = guid;
    this.shouldReloadOnServerRestart = shouldReloadOnServerRestart;
    this.handshake = new Promise(function (resolve, reject) {
      return _this5._handshake = { resolve: resolve, reject: reject };
    }).cancellable();
    this.listeners = {};
    this.subscriptions = {};
    this.store = {};
    this.pending = {};
    this.bindIOHandlers();
  };

  _classProps(Uplink, null, {
    destroy: {
      writable: true,
      value: function () {
        var _this6 = this;
        // Cancel all pending requests/active subscriptions/listeners
        if (!this.handshake.isResolved()) {
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
      }
    },
    bindIOHandlers: {
      writable: true,
      value: function () {
        var _this7 = this;
        Object.keys(ioHandlers).forEach(function (event) {
          return _this7.io.on(event, function (params) {
            _.dev(function () {
              return console.warn("nexus-uplink-client", "<<", event, params);
            });
            ioHandlers[event].call(_this7, _.prollyparse(params))["catch"](function (e) {
              return _.dev(function () {
                return console.error({ event: event, params: params, err: e.toString(), stack: e.stack });
              });
            });
          });
        });
      }
    },
    push: {
      writable: true,
      value: function (event, params) {
        _.dev(function () {
          return console.warn("nexus-uplink-client", ">>", event, params);
        });
        this.io.emit(event, params);
        return this;
      }
    },
    pull: {
      writable: true,
      value: function (path, opts) {
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
      }
    },
    fetch: {
      writable: true,
      value: function (path) {
        var _this9 = this;
        return new Promise(function (resolve, reject) {
          return request({ method: "GET", url: relative(_this9.http, path), json: true }, function (err, res, body) {
            return err ? reject(err) : resolve(body);
          });
        });
      }
    },
    dispatch: {
      writable: true,
      value: function (action, params) {
        var _this10 = this;
        _.dev(function () {
          return action.should.be.a.String && params.should.be.an.Object;
        });
        return new Promise(function (resolve, reject) {
          return request({ method: "POST", url: relative(_this10.http, action), json: true, body: _.extend({}, params, { guid: _this10.guid }) }, function (err, res, body) {
            return err ? reject(err) : resolve(body);
          });
        });
      }
    },
    _remoteSubscribeTo: {
      writable: true,
      value: function (path) {
        _.dev(function () {
          return path.should.be.a.String;
        });
        this.store[path] = { value: null, hash: null };
        this.io.emit("subscribeTo", { path: path });
      }
    },
    _remoteUnsubscribeFrom: {
      writable: true,
      value: function (path) {
        _.dev(function () {
          return path.should.be.a.String;
        });
        this.io.emit("unsubscribeFrom", { path: path });
        delete this.store[path];
      }
    },
    subscribeTo: {
      writable: true,
      value: function (path, handler) {
        _.dev(function () {
          return path.should.be.a.String && handler.should.be.a.Function;
        });
        var subscription = new Subscription({ path: path, handler: handler });
        var createdPath = subscription.addTo(this.subscriptions);
        if (createdPath) {
          this._remoteSubscribeTo(path);
        }
        return { subscription: subscription, createdPath: createdPath };
      }
    },
    unsubscribeFrom: {
      writable: true,
      value: function (subscription) {
        _.dev(function () {
          return subscription.should.be.an.instanceOf(Subscription);
        });
        var deletedPath = subscription.removeFrom(this.subscriptions);
        if (deletedPath) {
          this._remoteUnsubscribeFrom(subscription.path);
          delete this.store[subscription.path];
        }
        return { subscription: subscription, deletedPath: deletedPath };
      }
    },
    update: {
      writable: true,
      value: function (path, value) {
        var _this11 = this;
        _.dev(function () {
          return path.should.be.a.String && (value === null || _.isObject(value)).should.be.ok;
        });
        if (this.subscriptions[path]) {
          Object.keys(this.subscriptions[path]).forEach(function (key) {
            return _this11.subscriptions[path][key].update(value);
          });
        }
      }
    },
    _remoteListenTo: {
      writable: true,
      value: function (room) {
        _.dev(function () {
          return room.should.be.a.String;
        });
        this.io.emit("listenTo", { room: room });
      }
    },
    _remoteUnlistenFrom: {
      writable: true,
      value: function (room) {
        _.dev(function () {
          return room.should.be.a.String;
        });
        this.io.emit("unlistenFrom", { room: room });
      }
    },
    listenTo: {
      writable: true,
      value: function (room, handler) {
        _.dev(function () {
          return room.should.be.a.String && handler.should.be.a.Function;
        });
        var listener = new Listener({ room: room, handler: handler });
        var createdRoom = listener.addTo(this.listeners);
        if (createdRoom) {
          this._remoteListenTo(room);
        }
        return { listener: listener, createdRoom: createdRoom };
      }
    },
    unlistenFrom: {
      writable: true,
      value: function (listener) {
        _.dev(function () {
          return listener.should.be.an.instanceOf(Listener);
        });
        var deletedRoom = listener.removeFrom(this.listeners);
        if (deletedRoom) {
          this._remoteUnlistenFrom(listener.room);
        }
        return { listener: listener, deletedRoom: deletedRoom };
      }
    },
    emit: {
      writable: true,
      value: function (room, params) {
        var _this12 = this;
        _.dev(function () {
          return room.should.be.a.String && params.should.be.an.Object;
        });
        if (this.listeners[room]) {
          Object.keys(this.listeners[room]).forEach(function (key) {
            return _this12.listeners[room][key].emit(params);
          });
        }
      }
    }
  });

  return Uplink;
})();

_.extend(Uplink.prototype, {
  guid: null,
  handshake: null,
  _handshake: null,
  io: null,
  pid: null,
  listeners: null,
  shouldReloadOnServerRestart: null,
  subscriptions: null,
  store: null });

module.exports = Uplink;
//# sourceMappingURL=data:application/json;base64,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V0FBVyxFQUFFLENBQUM7T0FDbEM7O0FBRUQsUUFBSTs7YUFBQSxVQUFDLElBQUksRUFBRSxNQUFNLEVBQUU7O0FBQ2pCLFNBQUMsQ0FBQyxHQUFHLENBQUM7aUJBQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFDakMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU07U0FBQSxDQUMzQixDQUFDO0FBQ0YsWUFBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQ3ZCLGdCQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FDaEMsT0FBTyxDQUFDLFVBQUMsR0FBRzttQkFBSyxRQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1dBQUEsQ0FBQyxDQUFDO1NBQzNEO09BQ0Y7Ozs7U0F0S0csTUFBTTs7O0FBeUtaLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRTtBQUN6QixNQUFJLEVBQUUsSUFBSTtBQUNWLFdBQVMsRUFBRSxJQUFJO0FBQ2YsWUFBVSxFQUFFLElBQUk7QUFDaEIsSUFBRSxFQUFFLElBQUk7QUFDUixLQUFHLEVBQUUsSUFBSTtBQUNULFdBQVMsRUFBRSxJQUFJO0FBQ2YsNkJBQTJCLEVBQUUsSUFBSTtBQUNqQyxlQUFhLEVBQUUsSUFBSTtBQUNuQixPQUFLLEVBQUUsSUFBSSxFQUNaLENBQUMsQ0FBQzs7QUFFSCxNQUFNLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyIsImZpbGUiOiJVcGxpbmsuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcblxuY29uc3QgaW8gPSByZXF1aXJlKCdzb2NrZXQuaW8tY2xpZW50Jyk7XG5jb25zdCByZWxhdGl2ZSA9IHJlcXVpcmUoJ3VybCcpLnJlc29sdmU7XG5jb25zdCByZXF1ZXN0ID0gXy5pc1NlcnZlcigpID8gcmVxdWlyZSgncmVxdWVzdCcpIDogcmVxdWlyZSgnYnJvd3Nlci1yZXF1ZXN0Jyk7XG5cbmNvbnN0IExpc3RlbmVyID0gcmVxdWlyZSgnLi9MaXN0ZW5lcicpO1xuY29uc3QgU3Vic2NyaXB0aW9uID0gcmVxdWlyZSgnLi9TdWJzY3JpcHRpb24nKTtcblxuLy8gVGhlc2Ugc29ja2V0LmlvIGhhbmRsZXJzIGFyZSBhY3R1YWxseSBjYWxsZWQgbGlrZSBVcGxpbmsgaW5zdGFuY2UgbWV0aG9kXG4vLyAodXNpbmcgLmNhbGwpLiBJbiB0aGVpciBib2R5ICd0aGlzJyBpcyB0aGVyZWZvcmUgYW4gVXBsaW5rIGluc3RhbmNlLlxuLy8gVGhleSBhcmUgZGVjbGFyZWQgaGVyZSB0byBhdm9pZCBjbHV0dGVyaW5nIHRoZSBVcGxpbmsgY2xhc3MgZGVmaW5pdGlvblxuLy8gYW5kIG1ldGhvZCBuYW1pbmcgY29sbGlzaW9ucy5cbmNvbnN0IGlvSGFuZGxlcnMgPSBfLm1hcFZhbHVlcyh7XG4gICpjb25uZWN0KCkge1xuICAgIHRoaXMucHVzaCgnaGFuZHNoYWtlJywgeyBndWlkOiB0aGlzLmd1aWQgfSk7XG4gIH0sXG5cbiAgKnJlY29ubmVjdCgpIHtcbiAgICAvLyBUT0RPXG4gICAgLy8gSGFuZGxlIHJlY29ubmVjdGlvbnMgcHJvcGVybHkuXG4gIH0sXG5cbiAgKmRpc2Nvbm5lY3QoKSB7XG4gICAgLy8gVE9ET1xuICAgIC8vIEhhbmRsZSBkaXNjb25uZWN0aW9ucyBwcm9wZXJseVxuICB9LFxuXG4gICpoYW5kc2hha2VBY2soeyBwaWQgfSkge1xuICAgIGlmKHRoaXMucGlkICE9PSBudWxsICYmIHBpZCAhPT0gdGhpcy5waWQgJiYgdGhpcy5zaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQgJiYgXy5pc0NsaWVudCgpKSB7XG4gICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgfVxuICAgIHRoaXMucGlkID0gcGlkO1xuICAgIHRoaXMuX2hhbmRzaGFrZS5yZXNvbHZlKHsgcGlkIH0pO1xuICB9LFxuXG4gICp1cGRhdGUoeyBwYXRoLCBkaWZmLCBoYXNoIH0pIHtcbiAgICAvLyBBdCB0aGUgdXBsaW5rIGxldmVsLCB1cGRhdGVzIGFyZSB0cmFuc21pdHRlZFxuICAgIC8vIGFzIChkaWZmLCBoYXNoKS4gSWYgdGhlIHVwbGluayBjbGllbnQgaGFzXG4gICAgLy8gYSBjYWNoZWQgdmFsdWUgd2l0aCB0aGUgbWF0Y2hpbmcgaGFzaCwgdGhlblxuICAgIC8vIHRoZSBkaWZmIGlzIGFwcGxpZWQuIElmIG5vdCwgdGhlbiB0aGUgZnVsbCB2YWx1ZVxuICAgIC8vIGlzIGZldGNoZWQuXG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGlmKCF0aGlzLnN0b3JlW3BhdGhdKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmKHRoaXMuc3RvcmVbcGF0aF0uaGFzaCA9PT0gaGFzaCkge1xuICAgICAgdGhpcy5zdG9yZVtwYXRoXS52YWx1ZSA9IF8ucGF0Y2godGhpcy5zdG9yZVtwYXRoXSwgZGlmZik7XG4gICAgICB0aGlzLnN0b3JlW3BhdGhdLmhhc2ggPSBfLmhhc2godGhpcy5zdG9yZVtwYXRoXS52YWx1ZSk7XG4gICAgICB0aGlzLnVwZGF0ZShwYXRoLCB0aGlzLnN0b3JlW3BhdGhdKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBsZXQgdmFsdWUgPSB5aWVsZCB0aGlzLnB1bGwocGF0aCwgeyBieXBhc3NDYWNoZTogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcmVbcGF0aF0gPSB7IHZhbHVlLCBoYXNoOiBfLmhhc2godmFsdWUpIH07XG4gICAgICB0aGlzLnVwZGF0ZShwYXRoLCB0aGlzLnN0b3JlW3BhdGhdKTtcbiAgICB9XG4gIH0sXG5cbiAgKmVtaXQoeyByb29tLCBwYXJhbXMgfSkge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0KTtcbiAgICB0aGlzLmVtaXQocm9vbSwgcGFyYW1zKTtcbiAgfSxcblxuICAqZGVidWcoLi4uYXJncykge1xuICAgIGNvbnNvbGUudGFibGUoLi4uYXJncyk7XG4gIH0sXG5cbiAgKmxvZyguLi5hcmdzKSB7XG4gICAgY29uc29sZS5sb2coLi4uYXJncyk7XG4gIH0sXG5cbiAgKndhcm4oLi4uYXJncykge1xuICAgIGNvbnNvbGUud2FybiguLi5hcmdzKTtcbiAgfSxcblxuICAqZXJyKC4uLmFyZ3MpIHtcbiAgICBjb25zb2xlLmVycm9yKC4uLmFyZ3MpO1xuICB9LFxufSwgXy5jby53cmFwKTtcblxuY2xhc3MgVXBsaW5rIHtcbiAgY29uc3RydWN0b3IoeyB1cmwsIGd1aWQsIHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCB9KSB7XG4gICAgXy5kZXYoKCkgPT4gdXJsLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmdcbiAgICApO1xuICAgIHRoaXMuaHR0cCA9IHVybDtcbiAgICB0aGlzLmlvID0gaW8odXJsKTtcbiAgICB0aGlzLnBpZCA9IG51bGw7XG4gICAgdGhpcy5ndWlkID0gZ3VpZDtcbiAgICB0aGlzLnNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCA9IHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydDtcbiAgICB0aGlzLmhhbmRzaGFrZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHRoaXMuX2hhbmRzaGFrZSA9IHsgcmVzb2x2ZSwgcmVqZWN0IH0pLmNhbmNlbGxhYmxlKCk7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMgPSB7fTtcbiAgICB0aGlzLnN0b3JlID0ge307XG4gICAgdGhpcy5wZW5kaW5nID0ge307XG4gICAgdGhpcy5iaW5kSU9IYW5kbGVycygpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICAvLyBDYW5jZWwgYWxsIHBlbmRpbmcgcmVxdWVzdHMvYWN0aXZlIHN1YnNjcmlwdGlvbnMvbGlzdGVuZXJzXG4gICAgaWYoIXRoaXMuaGFuZHNoYWtlLmlzUmVzb2x2ZWQoKSkge1xuICAgICAgdGhpcy5oYW5kc2hha2UuY2FuY2VsKCk7XG4gICAgfVxuICAgIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaXB0aW9ucylcbiAgICAuZm9yRWFjaCgocGF0aCkgPT4gT2JqZWN0LmtleXModGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdKVxuICAgICAgLmZvckVhY2goKGlkKSA9PiB0aGlzLnVuc3Vic2NyaWJlRnJvbSh0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF1baWRdKSlcbiAgICApO1xuICAgIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzKVxuICAgIC5mb3JFYWNoKChyb29tKSA9PiBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSlcbiAgICAgIC5mb3JFYWNoKChpZCkgPT4gdGhpcy51bmxpc3RlbkZyb20odGhpcy5saXN0ZW5lcnNbcm9vbV1baWRdKSlcbiAgICApO1xuICAgIE9iamVjdC5rZXlzKHRoaXMucGVuZGluZylcbiAgICAuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgdGhpcy5wZW5kaW5nW3BhdGhdLmNhbmNlbCgpO1xuICAgICAgZGVsZXRlIHRoaXMucGVuZGluZ1twYXRoXTtcbiAgICB9KTtcbiAgICB0aGlzLmlvLmNsb3NlKCk7XG4gIH1cblxuICBiaW5kSU9IYW5kbGVycygpIHtcbiAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxuICAgIC5mb3JFYWNoKChldmVudCkgPT4gdGhpcy5pby5vbihldmVudCwgKHBhcmFtcykgPT4ge1xuICAgICAgXy5kZXYoKCkgPT4gY29uc29sZS53YXJuKCduZXh1cy11cGxpbmstY2xpZW50JywgJzw8JywgZXZlbnQsIHBhcmFtcykpO1xuICAgICAgaW9IYW5kbGVyc1tldmVudF0uY2FsbCh0aGlzLCBfLnByb2xseXBhcnNlKHBhcmFtcykpXG4gICAgICAuY2F0Y2goKGUpID0+IF8uZGV2KCgpID0+IGNvbnNvbGUuZXJyb3IoeyBldmVudCwgcGFyYW1zLCBlcnI6IGUudG9TdHJpbmcoKSwgc3RhY2s6IGUuc3RhY2sgfSkpKTtcbiAgICB9KSk7XG4gIH1cblxuICBwdXNoKGV2ZW50LCBwYXJhbXMpIHtcbiAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oJ25leHVzLXVwbGluay1jbGllbnQnLCAnPj4nLCBldmVudCwgcGFyYW1zKSk7XG4gICAgdGhpcy5pby5lbWl0KGV2ZW50LCBwYXJhbXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHVsbChwYXRoLCBvcHRzID0ge30pIHtcbiAgICBsZXQgeyBieXBhc3NDYWNoZSB9ID0gb3B0cztcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgaWYoIXRoaXMucGVuZGluZ1twYXRoXSB8fCBieXBhc3NDYWNoZSkge1xuICAgICAgdGhpcy5wZW5kaW5nW3BhdGhdID0gdGhpcy5mZXRjaChwYXRoKS5jYW5jZWxsYWJsZSgpLnRoZW4oKHZhbHVlKSA9PiB7XG4gICAgICAgIC8vIEFzIHNvb24gYXMgdGhlIHJlc3VsdCBpcyByZWNlaXZlZCwgcmVtb3ZlZCBmcm9tIHRoZSBwZW5kaW5nIGxpc3QuXG4gICAgICAgIGRlbGV0ZSB0aGlzLnBlbmRpbmdbcGF0aF07XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBfLmRldigoKSA9PiB0aGlzLnBlbmRpbmdbcGF0aF0udGhlbi5zaG91bGQuYmUuYS5GdW5jdGlvbik7XG4gICAgcmV0dXJuIHRoaXMucGVuZGluZ1twYXRoXTtcbiAgfVxuXG4gIGZldGNoKHBhdGgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT5cbiAgICAgIHJlcXVlc3QoeyBtZXRob2Q6ICdHRVQnLCB1cmw6IHJlbGF0aXZlKHRoaXMuaHR0cCwgcGF0aCksIGpzb246IHRydWUgfSwgKGVyciwgcmVzLCBib2R5KSA9PiBlcnIgPyByZWplY3QoZXJyKSA6IHJlc29sdmUoYm9keSkpXG4gICAgKTtcbiAgfVxuXG4gIGRpc3BhdGNoKGFjdGlvbiwgcGFyYW1zKSB7XG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3RcbiAgICApO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PlxuICAgICAgcmVxdWVzdCh7IG1ldGhvZDogJ1BPU1QnLCB1cmw6IHJlbGF0aXZlKHRoaXMuaHR0cCwgYWN0aW9uKSwganNvbjogdHJ1ZSwgYm9keTogXy5leHRlbmQoe30sIHBhcmFtcywgeyBndWlkOiB0aGlzLmd1aWQgfSkgfSwgKGVyciwgcmVzLCBib2R5KSA9PiBlcnIgPyByZWplY3QoZXJyKSA6IHJlc29sdmUoYm9keSkpXG4gICAgKTtcbiAgfVxuXG4gIF9yZW1vdGVTdWJzY3JpYmVUbyhwYXRoKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIHRoaXMuc3RvcmVbcGF0aF0gPSB7IHZhbHVlOiBudWxsLCBoYXNoOiBudWxsIH07XG4gICAgdGhpcy5pby5lbWl0KCdzdWJzY3JpYmVUbycsIHsgcGF0aCB9KTtcbiAgfVxuXG4gIF9yZW1vdGVVbnN1YnNjcmliZUZyb20ocGF0aCkge1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICB0aGlzLmlvLmVtaXQoJ3Vuc3Vic2NyaWJlRnJvbScsIHsgcGF0aCB9KTtcbiAgICBkZWxldGUgdGhpcy5zdG9yZVtwYXRoXTtcbiAgfVxuXG4gIHN1YnNjcmliZVRvKHBhdGgsIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgbGV0IHN1YnNjcmlwdGlvbiA9IG5ldyBTdWJzY3JpcHRpb24oeyBwYXRoLCBoYW5kbGVyIH0pO1xuICAgIGxldCBjcmVhdGVkUGF0aCA9IHN1YnNjcmlwdGlvbi5hZGRUbyh0aGlzLnN1YnNjcmlwdGlvbnMpO1xuICAgIGlmKGNyZWF0ZWRQYXRoKSB7XG4gICAgICB0aGlzLl9yZW1vdGVTdWJzY3JpYmVUbyhwYXRoKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgc3Vic2NyaXB0aW9uLCBjcmVhdGVkUGF0aCB9O1xuICB9XG5cbiAgdW5zdWJzY3JpYmVGcm9tKHN1YnNjcmlwdGlvbikge1xuICAgIF8uZGV2KCgpID0+IHN1YnNjcmlwdGlvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTdWJzY3JpcHRpb24pKTtcbiAgICBsZXQgZGVsZXRlZFBhdGggPSBzdWJzY3JpcHRpb24ucmVtb3ZlRnJvbSh0aGlzLnN1YnNjcmlwdGlvbnMpO1xuICAgIGlmKGRlbGV0ZWRQYXRoKSB7XG4gICAgICB0aGlzLl9yZW1vdGVVbnN1YnNjcmliZUZyb20oc3Vic2NyaXB0aW9uLnBhdGgpO1xuICAgICAgZGVsZXRlIHRoaXMuc3RvcmVbc3Vic2NyaXB0aW9uLnBhdGhdO1xuICAgIH1cbiAgICByZXR1cm4geyBzdWJzY3JpcHRpb24sIGRlbGV0ZWRQYXRoIH07XG4gIH1cblxuICB1cGRhdGUocGF0aCwgdmFsdWUpIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgKHZhbHVlID09PSBudWxsIHx8IF8uaXNPYmplY3QodmFsdWUpKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGlmKHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXSkge1xuICAgICAgT2JqZWN0LmtleXModGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdKVxuICAgICAgLmZvckVhY2goKGtleSkgPT4gdGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdW2tleV0udXBkYXRlKHZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgX3JlbW90ZUxpc3RlblRvKHJvb20pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgdGhpcy5pby5lbWl0KCdsaXN0ZW5UbycsIHsgcm9vbSB9KTtcbiAgfVxuXG4gIF9yZW1vdGVVbmxpc3RlbkZyb20ocm9vbSkge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICB0aGlzLmlvLmVtaXQoJ3VubGlzdGVuRnJvbScsIHsgcm9vbSB9KTtcbiAgfVxuXG4gIGxpc3RlblRvKHJvb20sIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgbGV0IGxpc3RlbmVyID0gbmV3IExpc3RlbmVyKHsgcm9vbSwgaGFuZGxlciB9KTtcbiAgICBsZXQgY3JlYXRlZFJvb20gPSBsaXN0ZW5lci5hZGRUbyh0aGlzLmxpc3RlbmVycyk7XG4gICAgaWYoY3JlYXRlZFJvb20pIHtcbiAgICAgIHRoaXMuX3JlbW90ZUxpc3RlblRvKHJvb20pO1xuICAgIH1cbiAgICByZXR1cm4geyBsaXN0ZW5lciwgY3JlYXRlZFJvb20gfTtcbiAgfVxuXG4gIHVubGlzdGVuRnJvbShsaXN0ZW5lcikge1xuICAgIF8uZGV2KCgpID0+IGxpc3RlbmVyLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKExpc3RlbmVyKSk7XG4gICAgbGV0IGRlbGV0ZWRSb29tID0gbGlzdGVuZXIucmVtb3ZlRnJvbSh0aGlzLmxpc3RlbmVycyk7XG4gICAgaWYoZGVsZXRlZFJvb20pIHtcbiAgICAgIHRoaXMuX3JlbW90ZVVubGlzdGVuRnJvbShsaXN0ZW5lci5yb29tKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgbGlzdGVuZXIsIGRlbGV0ZWRSb29tIH07XG4gIH1cblxuICBlbWl0KHJvb20sIHBhcmFtcykge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdFxuICAgICk7XG4gICAgaWYodGhpcy5saXN0ZW5lcnNbcm9vbV0pIHtcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKVxuICAgICAgLmZvckVhY2goKGtleSkgPT4gdGhpcy5saXN0ZW5lcnNbcm9vbV1ba2V5XS5lbWl0KHBhcmFtcykpO1xuICAgIH1cbiAgfVxufVxuXG5fLmV4dGVuZChVcGxpbmsucHJvdG90eXBlLCB7XG4gIGd1aWQ6IG51bGwsXG4gIGhhbmRzaGFrZTogbnVsbCxcbiAgX2hhbmRzaGFrZTogbnVsbCxcbiAgaW86IG51bGwsXG4gIHBpZDogbnVsbCxcbiAgbGlzdGVuZXJzOiBudWxsLFxuICBzaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQ6IG51bGwsXG4gIHN1YnNjcmlwdGlvbnM6IG51bGwsXG4gIHN0b3JlOiBudWxsLFxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVXBsaW5rO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9