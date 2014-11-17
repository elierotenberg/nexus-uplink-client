"use strict";

var _slice = Array.prototype.slice;
var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");
var Promise = require("bluebird");
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
var ioHandlers = {
  connect: function () {
    this.io.emit("handshake", { guid: this.guid });
  },

  reconnect: function () {},

  disconnect: function () {},

  handshakeAck: function (_ref) {
    var pid = _ref.pid;
    if (this.pid !== null && pid !== this.pid && this.shouldReloadOnServerRestart && _.isClient()) {
      window.location.reload();
    }
    this.pid = pid;
    this._handshake({ pid: pid });
  },

  update: function (_ref2) {
    var _this = this;
    var path = _ref2.path;
    var diff = _ref2.diff;
    var hash = _ref2.hash;
    // At the uplink level, updates are transmitted
    // as (diff, hash). If the uplink client has
    // a cached value with the matching hash, then
    // the diff is applied. If not, then the full value
    // is fetched.
    _.dev(function () {
      return path.should.be.a.String;
    });
    if (!this.store[path]) {
      return;
    }
    if (this.store[path].hash === hash) {
      this.store[path].value = _.patch(this.store[path], diff);
      this.store[path].hash = _.hash(this.store[path].value);
      this.update(path, this.store[path]);
    } else {
      this.pull(path, { bypassCache: true }).then(function (value) {
        return _this.store[path] = { value: value, hash: _.hash(value) };
      }).then(function () {
        return _this.update(path, _this.store[path]);
      });
    }
  },

  emit: function (_ref3) {
    var room = _ref3.room;
    var params = _ref3.params;
    _.dev(function () {
      return room.should.be.a.String && params.should.be.an.Object;
    });
    this.emit(room, params);
  },

  debug: function () {
    var args = _slice.call(arguments);

    console.table.apply(console, Array.from(args));
  },

  log: function () {
    var args = _slice.call(arguments);

    console.log.apply(console, Array.from(args));
  },

  warn: function () {
    var args = _slice.call(arguments);

    console.warn.apply(console, Array.from(args));
  },

  err: function () {
    var args = _slice.call(arguments);

    console.error.apply(console, Array.from(args));
  } };

var Uplink = (function () {
  var Uplink = function Uplink(_ref4) {
    var _this2 = this;
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
      return _this2._handshake = { resolve: resolve, reject: reject };
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
        var _this3 = this;
        // Cancel all pending requests/active subscriptions/listeners
        if (!this.handshake.isResolved()) {
          this.handshake.cancel();
        }
        Object.keys(this.subscriptions).forEach(function (path) {
          return Object.keys(_this3.subscriptions[path]).forEach(function (id) {
            return _this3.unsubscribeFrom(_this3.subscriptions[path][id]);
          });
        });
        Object.keys(this.listeners).forEach(function (room) {
          return Object.keys(_this3.listeners[room]).forEach(function (id) {
            return _this3.unlistenFrom(_this3.listeners[room][id]);
          });
        });
        Object.keys(this.pending).forEach(function (path) {
          _this3.pending[path].cancel();
          delete _this3.pending[path];
        });
        this.io.close();
      }
    },
    bindIOHandlers: {
      writable: true,
      value: function () {
        var _this4 = this;
        Object.keys(ioHandlers).forEach(function (event) {
          return _this4.io.on(event, function (params) {
            return ioHandlers[event].call(_this4, _.prollyparse(params));
          });
        });
      }
    },
    push: {
      writable: true,
      value: function (event, params) {
        this.io.emit(event, params);
        return this;
      }
    },
    pull: {
      writable: true,
      value: function (path, opts) {
        var _this5 = this;
        if (opts === undefined) opts = {};
        var bypassCache = opts.bypassCache;
        _.dev(function () {
          return path.should.be.a.String;
        });
        if (!this.pending[path] || bypassCache) {
          this.pending[path] = this.fetch(path).cancellable().then(function (value) {
            // As soon as the result is received, removed from the pending list.
            delete _this5.pending[path];
            return value;
          });
        }
        _.dev(function () {
          return _this5.pending[path].then.should.be.a.Function;
        });
        return this.pending[path];
      }
    },
    fetch: {
      writable: true,
      value: function (path) {
        var _this6 = this;
        return new Promise(function (resolve, reject) {
          return request({ method: "GET", url: relative(_this6.http, path), json: true }, function (err, res, body) {
            return err ? reject(err) : resolve(body);
          });
        });
      }
    },
    dispatch: {
      writable: true,
      value: function (action, params) {
        var _this7 = this;
        _.dev(function () {
          return action.should.be.a.String && params.should.be.an.Object;
        });
        return new Promise(function (resolve, reject) {
          return request({ method: "POST", url: relative(_this7.http, action), json: true, body: _.extend({}, params, { guid: _this7.guid }) }, function (err, res, body) {
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
        var _this8 = this;
        _.dev(function () {
          return path.should.be.a.String && (value === null || _.isObject(value)).should.be.ok;
        });
        if (this.subscriptions[path]) {
          Object.keys(this.subscriptions[path]).forEach(function (key) {
            return _this8.subscriptions[path][key].update(value);
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
        var _this9 = this;
        _.dev(function () {
          return room.should.be.a.String && params.should.be.an.Object;
        });
        if (this.listeners[room]) {
          Object.keys(this.listeners[room]).forEach(function (key) {
            return _this9.listeners[room][key].emit(params);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1jbGllbnQvc3JjL1VwbGluay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEMsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDOztBQUVqQyxJQUFNLEVBQUUsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUN2QyxJQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDO0FBQ3hDLElBQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7O0FBRS9FLElBQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN2QyxJQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzs7Ozs7O0FBTS9DLElBQU0sVUFBVSxHQUFHO0FBQ2pCLFNBQU8sRUFBQSxZQUFHO0FBQ1IsUUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0dBQ2hEOztBQUVELFdBQVMsRUFBQSxZQUFHLEVBR1g7O0FBRUQsWUFBVSxFQUFBLFlBQUcsRUFHWjs7QUFFRCxjQUFZLEVBQUEsZ0JBQVU7UUFBUCxHQUFHLFFBQUgsR0FBRztBQUNoQixRQUFHLElBQUksQ0FBQyxHQUFHLEtBQUssSUFBSSxJQUFJLEdBQUcsS0FBSyxJQUFJLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQywyQkFBMkIsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUU7QUFDNUYsWUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQztLQUMxQjtBQUNELFFBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ2YsUUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLEdBQUcsRUFBSCxHQUFHLEVBQUUsQ0FBQyxDQUFDO0dBQzFCOztBQUVELFFBQU0sRUFBQSxpQkFBdUI7O1FBQXBCLElBQUksU0FBSixJQUFJO1FBQUUsSUFBSSxTQUFKLElBQUk7UUFBRSxJQUFJLFNBQUosSUFBSTs7Ozs7O0FBTXZCLEtBQUMsQ0FBQyxHQUFHLENBQUM7YUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTTtLQUFBLENBQUMsQ0FBQztBQUNyQyxRQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUNwQixhQUFPO0tBQ1I7QUFDRCxRQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtBQUNqQyxVQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDekQsVUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3ZELFVBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUNyQyxNQUNJO0FBQ0gsVUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FDckMsSUFBSSxDQUFDLFVBQUMsS0FBSztlQUFLLE1BQUssS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFMLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRTtPQUFBLENBQUMsQ0FDbEUsSUFBSSxDQUFDO2VBQU0sTUFBSyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQUssS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO09BQUEsQ0FBQyxDQUFDO0tBQ2xEO0dBQ0Y7O0FBRUQsTUFBSSxFQUFBLGlCQUFtQjtRQUFoQixJQUFJLFNBQUosSUFBSTtRQUFFLE1BQU0sU0FBTixNQUFNO0FBQ2pCLEtBQUMsQ0FBQyxHQUFHLENBQUM7YUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNO0tBQUEsQ0FBQyxDQUFDO0FBQ25FLFFBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0dBRXpCOztBQUVELE9BQUssRUFBQSxZQUFVO1FBQU4sSUFBSTs7QUFDWCxXQUFPLENBQUMsS0FBSyxNQUFBLENBQWIsT0FBTyxhQUFVLElBQUksRUFBQyxDQUFDO0dBQ3hCOztBQUVELEtBQUcsRUFBQSxZQUFVO1FBQU4sSUFBSTs7QUFDVCxXQUFPLENBQUMsR0FBRyxNQUFBLENBQVgsT0FBTyxhQUFRLElBQUksRUFBQyxDQUFDO0dBQ3RCOztBQUVELE1BQUksRUFBQSxZQUFVO1FBQU4sSUFBSTs7QUFDVixXQUFPLENBQUMsSUFBSSxNQUFBLENBQVosT0FBTyxhQUFTLElBQUksRUFBQyxDQUFDO0dBQ3ZCOztBQUVELEtBQUcsRUFBQSxZQUFVO1FBQU4sSUFBSTs7QUFDVCxXQUFPLENBQUMsS0FBSyxNQUFBLENBQWIsT0FBTyxhQUFVLElBQUksRUFBQyxDQUFDO0dBQ3hCLEVBQ0YsQ0FBQzs7SUFFSSxNQUFNO01BQU4sTUFBTSxHQUNDLFNBRFAsTUFBTSxRQUM4Qzs7UUFBMUMsR0FBRyxTQUFILEdBQUc7UUFBRSxJQUFJLFNBQUosSUFBSTtRQUFFLDJCQUEyQixTQUEzQiwyQkFBMkI7QUFDbEQsS0FBQyxDQUFDLEdBQUcsQ0FBQzthQUFNLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQ2hDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNO0tBQUEsQ0FDeEIsQ0FBQztBQUNGLFFBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDO0FBQ2hCLFFBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2xCLFFBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDO0FBQ2hCLFFBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ2pCLFFBQUksQ0FBQywyQkFBMkIsR0FBRywyQkFBMkIsQ0FBQztBQUMvRCxRQUFJLENBQUMsU0FBUyxHQUFHLElBQUksT0FBTyxDQUFDLFVBQUMsT0FBTyxFQUFFLE1BQU07YUFBSyxPQUFLLFVBQVUsR0FBRyxFQUFFLE9BQU8sRUFBUCxPQUFPLEVBQUUsTUFBTSxFQUFOLE1BQU0sRUFBRTtLQUFBLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUN2RyxRQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQztBQUNwQixRQUFJLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQztBQUN4QixRQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztBQUNoQixRQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztBQUNsQixRQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7R0FDdkI7O2NBaEJHLE1BQU07QUFrQlYsV0FBTzs7YUFBQSxZQUFHOzs7QUFFUixZQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsRUFBRTtBQUMvQixjQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDO1NBQ3pCO0FBQ0QsY0FBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQzlCLE9BQU8sQ0FBQyxVQUFDLElBQUk7aUJBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFLLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUNyRCxPQUFPLENBQUMsVUFBQyxFQUFFO21CQUFLLE9BQUssZUFBZSxDQUFDLE9BQUssYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1dBQUEsQ0FBQztTQUFBLENBQ3JFLENBQUM7QUFDRixjQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FDMUIsT0FBTyxDQUFDLFVBQUMsSUFBSTtpQkFBSyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQUssU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQ2pELE9BQU8sQ0FBQyxVQUFDLEVBQUU7bUJBQUssT0FBSyxZQUFZLENBQUMsT0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7V0FBQSxDQUFDO1NBQUEsQ0FDOUQsQ0FBQztBQUNGLGNBQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUN4QixPQUFPLENBQUMsVUFBQyxJQUFJLEVBQUs7QUFDakIsaUJBQUssT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQzVCLGlCQUFPLE9BQUssT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzNCLENBQUMsQ0FBQztBQUNILFlBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUM7T0FDakI7O0FBRUQsa0JBQWM7O2FBQUEsWUFBRzs7QUFDZixjQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUN0QixPQUFPLENBQUMsVUFBQyxLQUFLO2lCQUFLLE9BQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsVUFBQyxNQUFNO21CQUFLLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLFNBQU8sQ0FBQyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztXQUFBLENBQUM7U0FBQSxDQUFDLENBQUM7T0FDekc7O0FBRUQsUUFBSTs7YUFBQSxVQUFDLEtBQUssRUFBRSxNQUFNLEVBQUU7QUFDbEIsWUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzVCLGVBQU8sSUFBSSxDQUFDO09BQ2I7O0FBRUQsUUFBSTs7YUFBQSxVQUFDLElBQUksRUFBRSxJQUFJLEVBQU87O1lBQVgsSUFBSSxnQkFBSixJQUFJLEdBQUcsRUFBRTtZQUNaLFdBQVcsR0FBSyxJQUFJLENBQXBCLFdBQVc7QUFDakIsU0FBQyxDQUFDLEdBQUcsQ0FBQztpQkFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTTtTQUFBLENBQUMsQ0FBQztBQUNyQyxZQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxXQUFXLEVBQUU7QUFDckMsY0FBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFDLEtBQUssRUFBSzs7QUFFbEUsbUJBQU8sT0FBSyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDMUIsbUJBQU8sS0FBSyxDQUFDO1dBQ2QsQ0FBQyxDQUFDO1NBQ0o7QUFDRCxTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLE9BQUssT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRO1NBQUEsQ0FBQyxDQUFDO0FBQzFELGVBQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztPQUMzQjs7QUFFRCxTQUFLOzthQUFBLFVBQUMsSUFBSSxFQUFFOztBQUNWLGVBQU8sSUFBSSxPQUFPLENBQUMsVUFBQyxPQUFPLEVBQUUsTUFBTTtpQkFDakMsT0FBTyxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsUUFBUSxDQUFDLE9BQUssSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxVQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSTttQkFBSyxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7V0FBQSxDQUFDO1NBQUEsQ0FDOUgsQ0FBQztPQUNIOztBQUVELFlBQVE7O2FBQUEsVUFBQyxNQUFNLEVBQUUsTUFBTSxFQUFFOztBQUN2QixTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQ25DLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNO1NBQUEsQ0FDM0IsQ0FBQztBQUNGLGVBQU8sSUFBSSxPQUFPLENBQUMsVUFBQyxPQUFPLEVBQUUsTUFBTTtpQkFDakMsT0FBTyxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsUUFBUSxDQUFDLE9BQUssSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxPQUFLLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxVQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSTttQkFBSyxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7V0FBQSxDQUFDO1NBQUEsQ0FDbEwsQ0FBQztPQUNIOztBQUVELHNCQUFrQjs7YUFBQSxVQUFDLElBQUksRUFBRTtBQUN2QixTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNO1NBQUEsQ0FBQyxDQUFDO0FBQ3JDLFlBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQztBQUMvQyxZQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLENBQUMsQ0FBQztPQUN2Qzs7QUFFRCwwQkFBc0I7O2FBQUEsVUFBQyxJQUFJLEVBQUU7QUFDM0IsU0FBQyxDQUFDLEdBQUcsQ0FBQztpQkFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTTtTQUFBLENBQUMsQ0FBQztBQUNyQyxZQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzFDLGVBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztPQUN6Qjs7QUFFRCxlQUFXOzthQUFBLFVBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRTtBQUN6QixTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQ2pDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRO1NBQUEsQ0FDN0IsQ0FBQztBQUNGLFlBQUksWUFBWSxHQUFHLElBQUksWUFBWSxDQUFDLEVBQUUsSUFBSSxFQUFKLElBQUksRUFBRSxPQUFPLEVBQVAsT0FBTyxFQUFFLENBQUMsQ0FBQztBQUN2RCxZQUFJLFdBQVcsR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUN6RCxZQUFHLFdBQVcsRUFBRTtBQUNkLGNBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUMvQjtBQUNELGVBQU8sRUFBRSxZQUFZLEVBQVosWUFBWSxFQUFFLFdBQVcsRUFBWCxXQUFXLEVBQUUsQ0FBQztPQUN0Qzs7QUFFRCxtQkFBZTs7YUFBQSxVQUFDLFlBQVksRUFBRTtBQUM1QixTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDO1NBQUEsQ0FBQyxDQUFDO0FBQ2hFLFlBQUksV0FBVyxHQUFHLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQzlELFlBQUcsV0FBVyxFQUFFO0FBQ2QsY0FBSSxDQUFDLHNCQUFzQixDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMvQyxpQkFBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN0QztBQUNELGVBQU8sRUFBRSxZQUFZLEVBQVosWUFBWSxFQUFFLFdBQVcsRUFBWCxXQUFXLEVBQUUsQ0FBQztPQUN0Qzs7QUFFRCxVQUFNOzthQUFBLFVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTs7QUFDbEIsU0FBQyxDQUFDLEdBQUcsQ0FBQztpQkFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUNqQyxDQUFDLEtBQUssS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRTtTQUFBLENBQ25ELENBQUM7QUFDRixZQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDM0IsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUNwQyxPQUFPLENBQUMsVUFBQyxHQUFHO21CQUFLLE9BQUssYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7V0FBQSxDQUFDLENBQUM7U0FDaEU7T0FDRjs7QUFFRCxtQkFBZTs7YUFBQSxVQUFDLElBQUksRUFBRTtBQUNwQixTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNO1NBQUEsQ0FBQyxDQUFDO0FBQ3JDLFlBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsQ0FBQyxDQUFDO09BQ3BDOztBQUVELHVCQUFtQjs7YUFBQSxVQUFDLElBQUksRUFBRTtBQUN4QixTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNO1NBQUEsQ0FBQyxDQUFDO0FBQ3JDLFlBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsQ0FBQyxDQUFDO09BQ3hDOztBQUVELFlBQVE7O2FBQUEsVUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFFO0FBQ3RCLFNBQUMsQ0FBQyxHQUFHLENBQUM7aUJBQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFDakMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVE7U0FBQSxDQUM3QixDQUFDO0FBQ0YsWUFBSSxRQUFRLEdBQUcsSUFBSSxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLE9BQU8sRUFBUCxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQy9DLFlBQUksV0FBVyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ2pELFlBQUcsV0FBVyxFQUFFO0FBQ2QsY0FBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUM1QjtBQUNELGVBQU8sRUFBRSxRQUFRLEVBQVIsUUFBUSxFQUFFLFdBQVcsRUFBWCxXQUFXLEVBQUUsQ0FBQztPQUNsQzs7QUFFRCxnQkFBWTs7YUFBQSxVQUFDLFFBQVEsRUFBRTtBQUNyQixTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDO1NBQUEsQ0FBQyxDQUFDO0FBQ3hELFlBQUksV0FBVyxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3RELFlBQUcsV0FBVyxFQUFFO0FBQ2QsY0FBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN6QztBQUNELGVBQU8sRUFBRSxRQUFRLEVBQVIsUUFBUSxFQUFFLFdBQVcsRUFBWCxXQUFXLEVBQUUsQ0FBQztPQUNsQzs7QUFFRCxRQUFJOzthQUFBLFVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRTs7QUFDakIsU0FBQyxDQUFDLEdBQUcsQ0FBQztpQkFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUNqQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTTtTQUFBLENBQzNCLENBQUM7QUFDRixZQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDdkIsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUNoQyxPQUFPLENBQUMsVUFBQyxHQUFHO21CQUFLLE9BQUssU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7V0FBQSxDQUFDLENBQUM7U0FDM0Q7T0FDRjs7OztTQWpLRyxNQUFNOzs7QUFvS1osQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFO0FBQ3pCLE1BQUksRUFBRSxJQUFJO0FBQ1YsV0FBUyxFQUFFLElBQUk7QUFDZixZQUFVLEVBQUUsSUFBSTtBQUNoQixJQUFFLEVBQUUsSUFBSTtBQUNSLEtBQUcsRUFBRSxJQUFJO0FBQ1QsV0FBUyxFQUFFLElBQUk7QUFDZiw2QkFBMkIsRUFBRSxJQUFJO0FBQ2pDLGVBQWEsRUFBRSxJQUFJO0FBQ25CLE9BQUssRUFBRSxJQUFJLEVBQ1osQ0FBQyxDQUFDOztBQUVILE1BQU0sQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDIiwiZmlsZSI6IlVwbGluay5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbmNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuXG5jb25zdCBpbyA9IHJlcXVpcmUoJ3NvY2tldC5pby1jbGllbnQnKTtcbmNvbnN0IHJlbGF0aXZlID0gcmVxdWlyZSgndXJsJykucmVzb2x2ZTtcbmNvbnN0IHJlcXVlc3QgPSBfLmlzU2VydmVyKCkgPyByZXF1aXJlKCdyZXF1ZXN0JykgOiByZXF1aXJlKCdicm93c2VyLXJlcXVlc3QnKTtcblxuY29uc3QgTGlzdGVuZXIgPSByZXF1aXJlKCcuL0xpc3RlbmVyJyk7XG5jb25zdCBTdWJzY3JpcHRpb24gPSByZXF1aXJlKCcuL1N1YnNjcmlwdGlvbicpO1xuXG4vLyBUaGVzZSBzb2NrZXQuaW8gaGFuZGxlcnMgYXJlIGFjdHVhbGx5IGNhbGxlZCBsaWtlIFVwbGluayBpbnN0YW5jZSBtZXRob2Rcbi8vICh1c2luZyAuY2FsbCkuIEluIHRoZWlyIGJvZHkgJ3RoaXMnIGlzIHRoZXJlZm9yZSBhbiBVcGxpbmsgaW5zdGFuY2UuXG4vLyBUaGV5IGFyZSBkZWNsYXJlZCBoZXJlIHRvIGF2b2lkIGNsdXR0ZXJpbmcgdGhlIFVwbGluayBjbGFzcyBkZWZpbml0aW9uXG4vLyBhbmQgbWV0aG9kIG5hbWluZyBjb2xsaXNpb25zLlxuY29uc3QgaW9IYW5kbGVycyA9IHtcbiAgY29ubmVjdCgpIHtcbiAgICB0aGlzLmlvLmVtaXQoJ2hhbmRzaGFrZScsIHsgZ3VpZDogdGhpcy5ndWlkIH0pO1xuICB9LFxuXG4gIHJlY29ubmVjdCgpIHtcbiAgICAvLyBUT0RPXG4gICAgLy8gSGFuZGxlIHJlY29ubmVjdGlvbnMgcHJvcGVybHkuXG4gIH0sXG5cbiAgZGlzY29ubmVjdCgpIHtcbiAgICAvLyBUT0RPXG4gICAgLy8gSGFuZGxlIGRpc2Nvbm5lY3Rpb25zIHByb3Blcmx5XG4gIH0sXG5cbiAgaGFuZHNoYWtlQWNrKHsgcGlkIH0pIHtcbiAgICBpZih0aGlzLnBpZCAhPT0gbnVsbCAmJiBwaWQgIT09IHRoaXMucGlkICYmIHRoaXMuc2hvdWxkUmVsb2FkT25TZXJ2ZXJSZXN0YXJ0ICYmIF8uaXNDbGllbnQoKSkge1xuICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuICAgIH1cbiAgICB0aGlzLnBpZCA9IHBpZDtcbiAgICB0aGlzLl9oYW5kc2hha2UoeyBwaWQgfSk7XG4gIH0sXG5cbiAgdXBkYXRlKHsgcGF0aCwgZGlmZiwgaGFzaCB9KSB7XG4gICAgLy8gQXQgdGhlIHVwbGluayBsZXZlbCwgdXBkYXRlcyBhcmUgdHJhbnNtaXR0ZWRcbiAgICAvLyBhcyAoZGlmZiwgaGFzaCkuIElmIHRoZSB1cGxpbmsgY2xpZW50IGhhc1xuICAgIC8vIGEgY2FjaGVkIHZhbHVlIHdpdGggdGhlIG1hdGNoaW5nIGhhc2gsIHRoZW5cbiAgICAvLyB0aGUgZGlmZiBpcyBhcHBsaWVkLiBJZiBub3QsIHRoZW4gdGhlIGZ1bGwgdmFsdWVcbiAgICAvLyBpcyBmZXRjaGVkLlxuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBpZighdGhpcy5zdG9yZVtwYXRoXSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZih0aGlzLnN0b3JlW3BhdGhdLmhhc2ggPT09IGhhc2gpIHtcbiAgICAgIHRoaXMuc3RvcmVbcGF0aF0udmFsdWUgPSBfLnBhdGNoKHRoaXMuc3RvcmVbcGF0aF0sIGRpZmYpO1xuICAgICAgdGhpcy5zdG9yZVtwYXRoXS5oYXNoID0gXy5oYXNoKHRoaXMuc3RvcmVbcGF0aF0udmFsdWUpO1xuICAgICAgdGhpcy51cGRhdGUocGF0aCwgdGhpcy5zdG9yZVtwYXRoXSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5wdWxsKHBhdGgsIHsgYnlwYXNzQ2FjaGU6IHRydWUgfSlcbiAgICAgIC50aGVuKCh2YWx1ZSkgPT4gdGhpcy5zdG9yZVtwYXRoXSA9IHsgdmFsdWUsIGhhc2g6IF8uaGFzaCh2YWx1ZSkgfSlcbiAgICAgIC50aGVuKCgpID0+IHRoaXMudXBkYXRlKHBhdGgsIHRoaXMuc3RvcmVbcGF0aF0pKTtcbiAgICB9XG4gIH0sXG5cbiAgZW1pdCh7IHJvb20sIHBhcmFtcyB9KSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiYgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3QpO1xuICAgIHRoaXMuZW1pdChyb29tLCBwYXJhbXMpO1xuXG4gIH0sXG5cbiAgZGVidWcoLi4uYXJncykge1xuICAgIGNvbnNvbGUudGFibGUoLi4uYXJncyk7XG4gIH0sXG5cbiAgbG9nKC4uLmFyZ3MpIHtcbiAgICBjb25zb2xlLmxvZyguLi5hcmdzKTtcbiAgfSxcblxuICB3YXJuKC4uLmFyZ3MpIHtcbiAgICBjb25zb2xlLndhcm4oLi4uYXJncyk7XG4gIH0sXG5cbiAgZXJyKC4uLmFyZ3MpIHtcbiAgICBjb25zb2xlLmVycm9yKC4uLmFyZ3MpO1xuICB9LFxufTtcblxuY2xhc3MgVXBsaW5rIHtcbiAgY29uc3RydWN0b3IoeyB1cmwsIGd1aWQsIHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCB9KSB7XG4gICAgXy5kZXYoKCkgPT4gdXJsLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmdcbiAgICApO1xuICAgIHRoaXMuaHR0cCA9IHVybDtcbiAgICB0aGlzLmlvID0gaW8odXJsKTtcbiAgICB0aGlzLnBpZCA9IG51bGw7XG4gICAgdGhpcy5ndWlkID0gZ3VpZDtcbiAgICB0aGlzLnNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCA9IHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydDtcbiAgICB0aGlzLmhhbmRzaGFrZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHRoaXMuX2hhbmRzaGFrZSA9IHsgcmVzb2x2ZSwgcmVqZWN0IH0pLmNhbmNlbGxhYmxlKCk7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMgPSB7fTtcbiAgICB0aGlzLnN0b3JlID0ge307XG4gICAgdGhpcy5wZW5kaW5nID0ge307XG4gICAgdGhpcy5iaW5kSU9IYW5kbGVycygpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICAvLyBDYW5jZWwgYWxsIHBlbmRpbmcgcmVxdWVzdHMvYWN0aXZlIHN1YnNjcmlwdGlvbnMvbGlzdGVuZXJzXG4gICAgaWYoIXRoaXMuaGFuZHNoYWtlLmlzUmVzb2x2ZWQoKSkge1xuICAgICAgdGhpcy5oYW5kc2hha2UuY2FuY2VsKCk7XG4gICAgfVxuICAgIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaXB0aW9ucylcbiAgICAuZm9yRWFjaCgocGF0aCkgPT4gT2JqZWN0LmtleXModGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdKVxuICAgICAgLmZvckVhY2goKGlkKSA9PiB0aGlzLnVuc3Vic2NyaWJlRnJvbSh0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF1baWRdKSlcbiAgICApO1xuICAgIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzKVxuICAgIC5mb3JFYWNoKChyb29tKSA9PiBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSlcbiAgICAgIC5mb3JFYWNoKChpZCkgPT4gdGhpcy51bmxpc3RlbkZyb20odGhpcy5saXN0ZW5lcnNbcm9vbV1baWRdKSlcbiAgICApO1xuICAgIE9iamVjdC5rZXlzKHRoaXMucGVuZGluZylcbiAgICAuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgdGhpcy5wZW5kaW5nW3BhdGhdLmNhbmNlbCgpO1xuICAgICAgZGVsZXRlIHRoaXMucGVuZGluZ1twYXRoXTtcbiAgICB9KTtcbiAgICB0aGlzLmlvLmNsb3NlKCk7XG4gIH1cblxuICBiaW5kSU9IYW5kbGVycygpIHtcbiAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxuICAgIC5mb3JFYWNoKChldmVudCkgPT4gdGhpcy5pby5vbihldmVudCwgKHBhcmFtcykgPT4gaW9IYW5kbGVyc1tldmVudF0uY2FsbCh0aGlzLCBfLnByb2xseXBhcnNlKHBhcmFtcykpKSk7XG4gIH1cblxuICBwdXNoKGV2ZW50LCBwYXJhbXMpIHtcbiAgICB0aGlzLmlvLmVtaXQoZXZlbnQsIHBhcmFtcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwdWxsKHBhdGgsIG9wdHMgPSB7fSkge1xuICAgIGxldCB7IGJ5cGFzc0NhY2hlIH0gPSBvcHRzO1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBpZighdGhpcy5wZW5kaW5nW3BhdGhdIHx8IGJ5cGFzc0NhY2hlKSB7XG4gICAgICB0aGlzLnBlbmRpbmdbcGF0aF0gPSB0aGlzLmZldGNoKHBhdGgpLmNhbmNlbGxhYmxlKCkudGhlbigodmFsdWUpID0+IHtcbiAgICAgICAgLy8gQXMgc29vbiBhcyB0aGUgcmVzdWx0IGlzIHJlY2VpdmVkLCByZW1vdmVkIGZyb20gdGhlIHBlbmRpbmcgbGlzdC5cbiAgICAgICAgZGVsZXRlIHRoaXMucGVuZGluZ1twYXRoXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfSk7XG4gICAgfVxuICAgIF8uZGV2KCgpID0+IHRoaXMucGVuZGluZ1twYXRoXS50aGVuLnNob3VsZC5iZS5hLkZ1bmN0aW9uKTtcbiAgICByZXR1cm4gdGhpcy5wZW5kaW5nW3BhdGhdO1xuICB9XG5cbiAgZmV0Y2gocGF0aCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PlxuICAgICAgcmVxdWVzdCh7IG1ldGhvZDogJ0dFVCcsIHVybDogcmVsYXRpdmUodGhpcy5odHRwLCBwYXRoKSwganNvbjogdHJ1ZSB9LCAoZXJyLCByZXMsIGJvZHkpID0+IGVyciA/IHJlamVjdChlcnIpIDogcmVzb2x2ZShib2R5KSlcbiAgICApO1xuICB9XG5cbiAgZGlzcGF0Y2goYWN0aW9uLCBwYXJhbXMpIHtcbiAgICBfLmRldigoKSA9PiBhY3Rpb24uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdFxuICAgICk7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+XG4gICAgICByZXF1ZXN0KHsgbWV0aG9kOiAnUE9TVCcsIHVybDogcmVsYXRpdmUodGhpcy5odHRwLCBhY3Rpb24pLCBqc29uOiB0cnVlLCBib2R5OiBfLmV4dGVuZCh7fSwgcGFyYW1zLCB7IGd1aWQ6IHRoaXMuZ3VpZCB9KSB9LCAoZXJyLCByZXMsIGJvZHkpID0+IGVyciA/IHJlamVjdChlcnIpIDogcmVzb2x2ZShib2R5KSlcbiAgICApO1xuICB9XG5cbiAgX3JlbW90ZVN1YnNjcmliZVRvKHBhdGgpIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgdGhpcy5zdG9yZVtwYXRoXSA9IHsgdmFsdWU6IG51bGwsIGhhc2g6IG51bGwgfTtcbiAgICB0aGlzLmlvLmVtaXQoJ3N1YnNjcmliZVRvJywgeyBwYXRoIH0pO1xuICB9XG5cbiAgX3JlbW90ZVVuc3Vic2NyaWJlRnJvbShwYXRoKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIHRoaXMuaW8uZW1pdCgndW5zdWJzY3JpYmVGcm9tJywgeyBwYXRoIH0pO1xuICAgIGRlbGV0ZSB0aGlzLnN0b3JlW3BhdGhdO1xuICB9XG5cbiAgc3Vic2NyaWJlVG8ocGF0aCwgaGFuZGxlcikge1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uXG4gICAgKTtcbiAgICBsZXQgc3Vic2NyaXB0aW9uID0gbmV3IFN1YnNjcmlwdGlvbih7IHBhdGgsIGhhbmRsZXIgfSk7XG4gICAgbGV0IGNyZWF0ZWRQYXRoID0gc3Vic2NyaXB0aW9uLmFkZFRvKHRoaXMuc3Vic2NyaXB0aW9ucyk7XG4gICAgaWYoY3JlYXRlZFBhdGgpIHtcbiAgICAgIHRoaXMuX3JlbW90ZVN1YnNjcmliZVRvKHBhdGgpO1xuICAgIH1cbiAgICByZXR1cm4geyBzdWJzY3JpcHRpb24sIGNyZWF0ZWRQYXRoIH07XG4gIH1cblxuICB1bnN1YnNjcmliZUZyb20oc3Vic2NyaXB0aW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gc3Vic2NyaXB0aW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFN1YnNjcmlwdGlvbikpO1xuICAgIGxldCBkZWxldGVkUGF0aCA9IHN1YnNjcmlwdGlvbi5yZW1vdmVGcm9tKHRoaXMuc3Vic2NyaXB0aW9ucyk7XG4gICAgaWYoZGVsZXRlZFBhdGgpIHtcbiAgICAgIHRoaXMuX3JlbW90ZVVuc3Vic2NyaWJlRnJvbShzdWJzY3JpcHRpb24ucGF0aCk7XG4gICAgICBkZWxldGUgdGhpcy5zdG9yZVtzdWJzY3JpcHRpb24ucGF0aF07XG4gICAgfVxuICAgIHJldHVybiB7IHN1YnNjcmlwdGlvbiwgZGVsZXRlZFBhdGggfTtcbiAgfVxuXG4gIHVwZGF0ZShwYXRoLCB2YWx1ZSkge1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAodmFsdWUgPT09IG51bGwgfHwgXy5pc09iamVjdCh2YWx1ZSkpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgaWYodGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdKSB7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF0pXG4gICAgICAuZm9yRWFjaCgoa2V5KSA9PiB0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF1ba2V5XS51cGRhdGUodmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICBfcmVtb3RlTGlzdGVuVG8ocm9vbSkge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICB0aGlzLmlvLmVtaXQoJ2xpc3RlblRvJywgeyByb29tIH0pO1xuICB9XG5cbiAgX3JlbW90ZVVubGlzdGVuRnJvbShyb29tKSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIHRoaXMuaW8uZW1pdCgndW5saXN0ZW5Gcm9tJywgeyByb29tIH0pO1xuICB9XG5cbiAgbGlzdGVuVG8ocm9vbSwgaGFuZGxlcikge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uXG4gICAgKTtcbiAgICBsZXQgbGlzdGVuZXIgPSBuZXcgTGlzdGVuZXIoeyByb29tLCBoYW5kbGVyIH0pO1xuICAgIGxldCBjcmVhdGVkUm9vbSA9IGxpc3RlbmVyLmFkZFRvKHRoaXMubGlzdGVuZXJzKTtcbiAgICBpZihjcmVhdGVkUm9vbSkge1xuICAgICAgdGhpcy5fcmVtb3RlTGlzdGVuVG8ocm9vbSk7XG4gICAgfVxuICAgIHJldHVybiB7IGxpc3RlbmVyLCBjcmVhdGVkUm9vbSB9O1xuICB9XG5cbiAgdW5saXN0ZW5Gcm9tKGxpc3RlbmVyKSB7XG4gICAgXy5kZXYoKCkgPT4gbGlzdGVuZXIuc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoTGlzdGVuZXIpKTtcbiAgICBsZXQgZGVsZXRlZFJvb20gPSBsaXN0ZW5lci5yZW1vdmVGcm9tKHRoaXMubGlzdGVuZXJzKTtcbiAgICBpZihkZWxldGVkUm9vbSkge1xuICAgICAgdGhpcy5fcmVtb3RlVW5saXN0ZW5Gcm9tKGxpc3RlbmVyLnJvb20pO1xuICAgIH1cbiAgICByZXR1cm4geyBsaXN0ZW5lciwgZGVsZXRlZFJvb20gfTtcbiAgfVxuXG4gIGVtaXQocm9vbSwgcGFyYW1zKSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0XG4gICAgKTtcbiAgICBpZih0aGlzLmxpc3RlbmVyc1tyb29tXSkge1xuICAgICAgT2JqZWN0LmtleXModGhpcy5saXN0ZW5lcnNbcm9vbV0pXG4gICAgICAuZm9yRWFjaCgoa2V5KSA9PiB0aGlzLmxpc3RlbmVyc1tyb29tXVtrZXldLmVtaXQocGFyYW1zKSk7XG4gICAgfVxuICB9XG59XG5cbl8uZXh0ZW5kKFVwbGluay5wcm90b3R5cGUsIHtcbiAgZ3VpZDogbnVsbCxcbiAgaGFuZHNoYWtlOiBudWxsLFxuICBfaGFuZHNoYWtlOiBudWxsLFxuICBpbzogbnVsbCxcbiAgcGlkOiBudWxsLFxuICBsaXN0ZW5lcnM6IG51bGwsXG4gIHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydDogbnVsbCxcbiAgc3Vic2NyaXB0aW9uczogbnVsbCxcbiAgc3RvcmU6IG51bGwsXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBVcGxpbms7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=