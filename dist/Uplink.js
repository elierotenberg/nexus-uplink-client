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
var ioHandlers = {
  connect: function () {
    this.push("handshake", { guid: this.guid });
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
            _.dev(function () {
              return console.warn("nexus-uplink-client", "<<", event, params);
            });
            return ioHandlers[event].call(_this4, _.prollyparse(params));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1jbGllbnQvc3JjL1VwbGluay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxBQUFDLElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxBQUFDLElBQU0sT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssWUFBWSxDQUFDLENBQUM7QUFDdkgsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDOztBQUVqQyxJQUFNLEVBQUUsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUN2QyxJQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDO0FBQ3hDLElBQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7O0FBRS9FLElBQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN2QyxJQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzs7Ozs7O0FBTS9DLElBQU0sVUFBVSxHQUFHO0FBQ2pCLFNBQU8sRUFBQSxZQUFHO0FBQ1IsUUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7R0FDN0M7O0FBRUQsV0FBUyxFQUFBLFlBQUcsRUFHWDs7QUFFRCxZQUFVLEVBQUEsWUFBRyxFQUdaOztBQUVELGNBQVksRUFBQSxnQkFBVTtRQUFQLEdBQUcsUUFBSCxHQUFHO0FBQ2hCLFFBQUcsSUFBSSxDQUFDLEdBQUcsS0FBSyxJQUFJLElBQUksR0FBRyxLQUFLLElBQUksQ0FBQyxHQUFHLElB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QyxDQUFDLENBQ2hDLE9BQU8sQ0FBQyxVQUFDLEdBQUc7bUJBQUssT0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztXQUFBLENBQUMsQ0FBQztTQUMzRDtPQUNGOzs7O1NBcktHLE1BQU07OztBQXdLWixDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7QUFDekIsTUFBSSxFQUFFLElBQUk7QUFDVixXQUFTLEVBQUUsSUFBSTtBQUNmLFlBQVUsRUFBRSxJQUFJO0FBQ2hCLElBQUUsRUFBRSxJQUFJO0FBQ1IsS0FBRyxFQUFFLElBQUk7QUFDVCxXQUFTLEVBQUUsSUFBSTtBQUNmLDZCQUEyQixFQUFFLElBQUk7QUFDakMsZUFBYSxFQUFFLElBQUk7QUFDbkIsT0FBSyxFQUFFLElBQUksRUFDWixDQUFDLENBQUM7O0FBRUgsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMiLCJmaWxlIjoiVXBsaW5rLmpzIiwic291cmNlc0NvbnRlbnQiOlsicmVxdWlyZSgnNnRvNS9wb2x5ZmlsbCcpOyBjb25zdCBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTsgY29uc3QgX19ERVZfXyA9IChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKTtcbmNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuXG5jb25zdCBpbyA9IHJlcXVpcmUoJ3NvY2tldC5pby1jbGllbnQnKTtcbmNvbnN0IHJlbGF0aXZlID0gcmVxdWlyZSgndXJsJykucmVzb2x2ZTtcbmNvbnN0IHJlcXVlc3QgPSBfLmlzU2VydmVyKCkgPyByZXF1aXJlKCdyZXF1ZXN0JykgOiByZXF1aXJlKCdicm93c2VyLXJlcXVlc3QnKTtcblxuY29uc3QgTGlzdGVuZXIgPSByZXF1aXJlKCcuL0xpc3RlbmVyJyk7XG5jb25zdCBTdWJzY3JpcHRpb24gPSByZXF1aXJlKCcuL1N1YnNjcmlwdGlvbicpO1xuXG4vLyBUaGVzZSBzb2NrZXQuaW8gaGFuZGxlcnMgYXJlIGFjdHVhbGx5IGNhbGxlZCBsaWtlIFVwbGluayBpbnN0YW5jZSBtZXRob2Rcbi8vICh1c2luZyAuY2FsbCkuIEluIHRoZWlyIGJvZHkgJ3RoaXMnIGlzIHRoZXJlZm9yZSBhbiBVcGxpbmsgaW5zdGFuY2UuXG4vLyBUaGV5IGFyZSBkZWNsYXJlZCBoZXJlIHRvIGF2b2lkIGNsdXR0ZXJpbmcgdGhlIFVwbGluayBjbGFzcyBkZWZpbml0aW9uXG4vLyBhbmQgbWV0aG9kIG5hbWluZyBjb2xsaXNpb25zLlxuY29uc3QgaW9IYW5kbGVycyA9IHtcbiAgY29ubmVjdCgpIHtcbiAgICB0aGlzLnB1c2goJ2hhbmRzaGFrZScsIHsgZ3VpZDogdGhpcy5ndWlkIH0pO1xuICB9LFxuXG4gIHJlY29ubmVjdCgpIHtcbiAgICAvLyBUT0RPXG4gICAgLy8gSGFuZGxlIHJlY29ubmVjdGlvbnMgcHJvcGVybHkuXG4gIH0sXG5cbiAgZGlzY29ubmVjdCgpIHtcbiAgICAvLyBUT0RPXG4gICAgLy8gSGFuZGxlIGRpc2Nvbm5lY3Rpb25zIHByb3Blcmx5XG4gIH0sXG5cbiAgaGFuZHNoYWtlQWNrKHsgcGlkIH0pIHtcbiAgICBpZih0aGlzLnBpZCAhPT0gbnVsbCAmJiBwaWQgIT09IHRoaXMucGlkICYmIHRoaXMuc2hvdWxkUmVsb2FkT25TZXJ2ZXJSZXN0YXJ0ICYmIF8uaXNDbGllbnQoKSkge1xuICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuICAgIH1cbiAgICB0aGlzLnBpZCA9IHBpZDtcbiAgICB0aGlzLl9oYW5kc2hha2UoeyBwaWQgfSk7XG4gIH0sXG5cbiAgdXBkYXRlKHsgcGF0aCwgZGlmZiwgaGFzaCB9KSB7XG4gICAgLy8gQXQgdGhlIHVwbGluayBsZXZlbCwgdXBkYXRlcyBhcmUgdHJhbnNtaXR0ZWRcbiAgICAvLyBhcyAoZGlmZiwgaGFzaCkuIElmIHRoZSB1cGxpbmsgY2xpZW50IGhhc1xuICAgIC8vIGEgY2FjaGVkIHZhbHVlIHdpdGggdGhlIG1hdGNoaW5nIGhhc2gsIHRoZW5cbiAgICAvLyB0aGUgZGlmZiBpcyBhcHBsaWVkLiBJZiBub3QsIHRoZW4gdGhlIGZ1bGwgdmFsdWVcbiAgICAvLyBpcyBmZXRjaGVkLlxuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBpZighdGhpcy5zdG9yZVtwYXRoXSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZih0aGlzLnN0b3JlW3BhdGhdLmhhc2ggPT09IGhhc2gpIHtcbiAgICAgIHRoaXMuc3RvcmVbcGF0aF0udmFsdWUgPSBfLnBhdGNoKHRoaXMuc3RvcmVbcGF0aF0sIGRpZmYpO1xuICAgICAgdGhpcy5zdG9yZVtwYXRoXS5oYXNoID0gXy5oYXNoKHRoaXMuc3RvcmVbcGF0aF0udmFsdWUpO1xuICAgICAgdGhpcy51cGRhdGUocGF0aCwgdGhpcy5zdG9yZVtwYXRoXSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5wdWxsKHBhdGgsIHsgYnlwYXNzQ2FjaGU6IHRydWUgfSlcbiAgICAgIC50aGVuKCh2YWx1ZSkgPT4gdGhpcy5zdG9yZVtwYXRoXSA9IHsgdmFsdWUsIGhhc2g6IF8uaGFzaCh2YWx1ZSkgfSlcbiAgICAgIC50aGVuKCgpID0+IHRoaXMudXBkYXRlKHBhdGgsIHRoaXMuc3RvcmVbcGF0aF0pKTtcbiAgICB9XG4gIH0sXG5cbiAgZW1pdCh7IHJvb20sIHBhcmFtcyB9KSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiYgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3QpO1xuICAgIHRoaXMuZW1pdChyb29tLCBwYXJhbXMpO1xuICB9LFxuXG4gIGRlYnVnKC4uLmFyZ3MpIHtcbiAgICBjb25zb2xlLnRhYmxlKC4uLmFyZ3MpO1xuICB9LFxuXG4gIGxvZyguLi5hcmdzKSB7XG4gICAgY29uc29sZS5sb2coLi4uYXJncyk7XG4gIH0sXG5cbiAgd2FybiguLi5hcmdzKSB7XG4gICAgY29uc29sZS53YXJuKC4uLmFyZ3MpO1xuICB9LFxuXG4gIGVyciguLi5hcmdzKSB7XG4gICAgY29uc29sZS5lcnJvciguLi5hcmdzKTtcbiAgfSxcbn07XG5cbmNsYXNzIFVwbGluayB7XG4gIGNvbnN0cnVjdG9yKHsgdXJsLCBndWlkLCBzaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQgfSkge1xuICAgIF8uZGV2KCgpID0+IHVybC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nXG4gICAgKTtcbiAgICB0aGlzLmh0dHAgPSB1cmw7XG4gICAgdGhpcy5pbyA9IGlvKHVybCk7XG4gICAgdGhpcy5waWQgPSBudWxsO1xuICAgIHRoaXMuZ3VpZCA9IGd1aWQ7XG4gICAgdGhpcy5zaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQgPSBzaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQ7XG4gICAgdGhpcy5oYW5kc2hha2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB0aGlzLl9oYW5kc2hha2UgPSB7IHJlc29sdmUsIHJlamVjdCB9KS5jYW5jZWxsYWJsZSgpO1xuICAgIHRoaXMubGlzdGVuZXJzID0ge307XG4gICAgdGhpcy5zdWJzY3JpcHRpb25zID0ge307XG4gICAgdGhpcy5zdG9yZSA9IHt9O1xuICAgIHRoaXMucGVuZGluZyA9IHt9O1xuICAgIHRoaXMuYmluZElPSGFuZGxlcnMoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgLy8gQ2FuY2VsIGFsbCBwZW5kaW5nIHJlcXVlc3RzL2FjdGl2ZSBzdWJzY3JpcHRpb25zL2xpc3RlbmVyc1xuICAgIGlmKCF0aGlzLmhhbmRzaGFrZS5pc1Jlc29sdmVkKCkpIHtcbiAgICAgIHRoaXMuaGFuZHNoYWtlLmNhbmNlbCgpO1xuICAgIH1cbiAgICBPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmlwdGlvbnMpXG4gICAgLmZvckVhY2goKHBhdGgpID0+IE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXSlcbiAgICAgIC5mb3JFYWNoKChpZCkgPT4gdGhpcy51bnN1YnNjcmliZUZyb20odGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdW2lkXSkpXG4gICAgKTtcbiAgICBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVycylcbiAgICAuZm9yRWFjaCgocm9vbSkgPT4gT2JqZWN0LmtleXModGhpcy5saXN0ZW5lcnNbcm9vbV0pXG4gICAgICAuZm9yRWFjaCgoaWQpID0+IHRoaXMudW5saXN0ZW5Gcm9tKHRoaXMubGlzdGVuZXJzW3Jvb21dW2lkXSkpXG4gICAgKTtcbiAgICBPYmplY3Qua2V5cyh0aGlzLnBlbmRpbmcpXG4gICAgLmZvckVhY2goKHBhdGgpID0+IHtcbiAgICAgIHRoaXMucGVuZGluZ1twYXRoXS5jYW5jZWwoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLnBlbmRpbmdbcGF0aF07XG4gICAgfSk7XG4gICAgdGhpcy5pby5jbG9zZSgpO1xuICB9XG5cbiAgYmluZElPSGFuZGxlcnMoKSB7XG4gICAgT2JqZWN0LmtleXMoaW9IYW5kbGVycylcbiAgICAuZm9yRWFjaCgoZXZlbnQpID0+IHRoaXMuaW8ub24oZXZlbnQsIChwYXJhbXMpID0+IHtcbiAgICAgIF8uZGV2KCgpID0+IGNvbnNvbGUud2FybignbmV4dXMtdXBsaW5rLWNsaWVudCcsICc8PCcsIGV2ZW50LCBwYXJhbXMpKTtcbiAgICAgIHJldHVybiBpb0hhbmRsZXJzW2V2ZW50XS5jYWxsKHRoaXMsIF8ucHJvbGx5cGFyc2UocGFyYW1zKSk7XG4gICAgfSkpO1xuICB9XG5cbiAgcHVzaChldmVudCwgcGFyYW1zKSB7XG4gICAgXy5kZXYoKCkgPT4gY29uc29sZS53YXJuKCduZXh1cy11cGxpbmstY2xpZW50JywgJz4+JywgZXZlbnQsIHBhcmFtcykpO1xuICAgIHRoaXMuaW8uZW1pdChldmVudCwgcGFyYW1zKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1bGwocGF0aCwgb3B0cyA9IHt9KSB7XG4gICAgbGV0IHsgYnlwYXNzQ2FjaGUgfSA9IG9wdHM7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGlmKCF0aGlzLnBlbmRpbmdbcGF0aF0gfHwgYnlwYXNzQ2FjaGUpIHtcbiAgICAgIHRoaXMucGVuZGluZ1twYXRoXSA9IHRoaXMuZmV0Y2gocGF0aCkuY2FuY2VsbGFibGUoKS50aGVuKCh2YWx1ZSkgPT4ge1xuICAgICAgICAvLyBBcyBzb29uIGFzIHRoZSByZXN1bHQgaXMgcmVjZWl2ZWQsIHJlbW92ZWQgZnJvbSB0aGUgcGVuZGluZyBsaXN0LlxuICAgICAgICBkZWxldGUgdGhpcy5wZW5kaW5nW3BhdGhdO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9KTtcbiAgICB9XG4gICAgXy5kZXYoKCkgPT4gdGhpcy5wZW5kaW5nW3BhdGhdLnRoZW4uc2hvdWxkLmJlLmEuRnVuY3Rpb24pO1xuICAgIHJldHVybiB0aGlzLnBlbmRpbmdbcGF0aF07XG4gIH1cblxuICBmZXRjaChwYXRoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+XG4gICAgICByZXF1ZXN0KHsgbWV0aG9kOiAnR0VUJywgdXJsOiByZWxhdGl2ZSh0aGlzLmh0dHAsIHBhdGgpLCBqc29uOiB0cnVlIH0sIChlcnIsIHJlcywgYm9keSkgPT4gZXJyID8gcmVqZWN0KGVycikgOiByZXNvbHZlKGJvZHkpKVxuICAgICk7XG4gIH1cblxuICBkaXNwYXRjaChhY3Rpb24sIHBhcmFtcykge1xuICAgIF8uZGV2KCgpID0+IGFjdGlvbi5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0XG4gICAgKTtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT5cbiAgICAgIHJlcXVlc3QoeyBtZXRob2Q6ICdQT1NUJywgdXJsOiByZWxhdGl2ZSh0aGlzLmh0dHAsIGFjdGlvbiksIGpzb246IHRydWUsIGJvZHk6IF8uZXh0ZW5kKHt9LCBwYXJhbXMsIHsgZ3VpZDogdGhpcy5ndWlkIH0pIH0sIChlcnIsIHJlcywgYm9keSkgPT4gZXJyID8gcmVqZWN0KGVycikgOiByZXNvbHZlKGJvZHkpKVxuICAgICk7XG4gIH1cblxuICBfcmVtb3RlU3Vic2NyaWJlVG8ocGF0aCkge1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICB0aGlzLnN0b3JlW3BhdGhdID0geyB2YWx1ZTogbnVsbCwgaGFzaDogbnVsbCB9O1xuICAgIHRoaXMuaW8uZW1pdCgnc3Vic2NyaWJlVG8nLCB7IHBhdGggfSk7XG4gIH1cblxuICBfcmVtb3RlVW5zdWJzY3JpYmVGcm9tKHBhdGgpIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgdGhpcy5pby5lbWl0KCd1bnN1YnNjcmliZUZyb20nLCB7IHBhdGggfSk7XG4gICAgZGVsZXRlIHRoaXMuc3RvcmVbcGF0aF07XG4gIH1cblxuICBzdWJzY3JpYmVUbyhwYXRoLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGhhbmRsZXIuc2hvdWxkLmJlLmEuRnVuY3Rpb25cbiAgICApO1xuICAgIGxldCBzdWJzY3JpcHRpb24gPSBuZXcgU3Vic2NyaXB0aW9uKHsgcGF0aCwgaGFuZGxlciB9KTtcbiAgICBsZXQgY3JlYXRlZFBhdGggPSBzdWJzY3JpcHRpb24uYWRkVG8odGhpcy5zdWJzY3JpcHRpb25zKTtcbiAgICBpZihjcmVhdGVkUGF0aCkge1xuICAgICAgdGhpcy5fcmVtb3RlU3Vic2NyaWJlVG8ocGF0aCk7XG4gICAgfVxuICAgIHJldHVybiB7IHN1YnNjcmlwdGlvbiwgY3JlYXRlZFBhdGggfTtcbiAgfVxuXG4gIHVuc3Vic2NyaWJlRnJvbShzdWJzY3JpcHRpb24pIHtcbiAgICBfLmRldigoKSA9PiBzdWJzY3JpcHRpb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU3Vic2NyaXB0aW9uKSk7XG4gICAgbGV0IGRlbGV0ZWRQYXRoID0gc3Vic2NyaXB0aW9uLnJlbW92ZUZyb20odGhpcy5zdWJzY3JpcHRpb25zKTtcbiAgICBpZihkZWxldGVkUGF0aCkge1xuICAgICAgdGhpcy5fcmVtb3RlVW5zdWJzY3JpYmVGcm9tKHN1YnNjcmlwdGlvbi5wYXRoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN0b3JlW3N1YnNjcmlwdGlvbi5wYXRoXTtcbiAgICB9XG4gICAgcmV0dXJuIHsgc3Vic2NyaXB0aW9uLCBkZWxldGVkUGF0aCB9O1xuICB9XG5cbiAgdXBkYXRlKHBhdGgsIHZhbHVlKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICh2YWx1ZSA9PT0gbnVsbCB8fCBfLmlzT2JqZWN0KHZhbHVlKSkuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICBpZih0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF0pIHtcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXSlcbiAgICAgIC5mb3JFYWNoKChrZXkpID0+IHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXVtrZXldLnVwZGF0ZSh2YWx1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIF9yZW1vdGVMaXN0ZW5Ubyhyb29tKSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIHRoaXMuaW8uZW1pdCgnbGlzdGVuVG8nLCB7IHJvb20gfSk7XG4gIH1cblxuICBfcmVtb3RlVW5saXN0ZW5Gcm9tKHJvb20pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgdGhpcy5pby5lbWl0KCd1bmxpc3RlbkZyb20nLCB7IHJvb20gfSk7XG4gIH1cblxuICBsaXN0ZW5Ubyhyb29tLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGhhbmRsZXIuc2hvdWxkLmJlLmEuRnVuY3Rpb25cbiAgICApO1xuICAgIGxldCBsaXN0ZW5lciA9IG5ldyBMaXN0ZW5lcih7IHJvb20sIGhhbmRsZXIgfSk7XG4gICAgbGV0IGNyZWF0ZWRSb29tID0gbGlzdGVuZXIuYWRkVG8odGhpcy5saXN0ZW5lcnMpO1xuICAgIGlmKGNyZWF0ZWRSb29tKSB7XG4gICAgICB0aGlzLl9yZW1vdGVMaXN0ZW5Ubyhyb29tKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgbGlzdGVuZXIsIGNyZWF0ZWRSb29tIH07XG4gIH1cblxuICB1bmxpc3RlbkZyb20obGlzdGVuZXIpIHtcbiAgICBfLmRldigoKSA9PiBsaXN0ZW5lci5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihMaXN0ZW5lcikpO1xuICAgIGxldCBkZWxldGVkUm9vbSA9IGxpc3RlbmVyLnJlbW92ZUZyb20odGhpcy5saXN0ZW5lcnMpO1xuICAgIGlmKGRlbGV0ZWRSb29tKSB7XG4gICAgICB0aGlzLl9yZW1vdGVVbmxpc3RlbkZyb20obGlzdGVuZXIucm9vbSk7XG4gICAgfVxuICAgIHJldHVybiB7IGxpc3RlbmVyLCBkZWxldGVkUm9vbSB9O1xuICB9XG5cbiAgZW1pdChyb29tLCBwYXJhbXMpIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3RcbiAgICApO1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3Jvb21dKSB7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSlcbiAgICAgIC5mb3JFYWNoKChrZXkpID0+IHRoaXMubGlzdGVuZXJzW3Jvb21dW2tleV0uZW1pdChwYXJhbXMpKTtcbiAgICB9XG4gIH1cbn1cblxuXy5leHRlbmQoVXBsaW5rLnByb3RvdHlwZSwge1xuICBndWlkOiBudWxsLFxuICBoYW5kc2hha2U6IG51bGwsXG4gIF9oYW5kc2hha2U6IG51bGwsXG4gIGlvOiBudWxsLFxuICBwaWQ6IG51bGwsXG4gIGxpc3RlbmVyczogbnVsbCxcbiAgc2hvdWxkUmVsb2FkT25TZXJ2ZXJSZXN0YXJ0OiBudWxsLFxuICBzdWJzY3JpcHRpb25zOiBudWxsLFxuICBzdG9yZTogbnVsbCxcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVwbGluaztcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==