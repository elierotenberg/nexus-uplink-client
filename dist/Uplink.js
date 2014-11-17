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
          return _this4.io.on(event, function (jsonParams) {
            return ioHandlers[event].call(_this4, JSON.parse(jsonParams || "{}"));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1jbGllbnQvc3JjL1VwbGluay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEMsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDOztBQUVqQyxJQUFNLEVBQUUsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUN2QyxJQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDO0FBQ3hDLElBQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7O0FBRS9FLElBQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN2QyxJQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzs7Ozs7O0FBTS9DLElBQU0sVUFBVSxHQUFHO0FBQ2pCLFNBQU8sRUFBQSxZQUFHO0FBQ1IsUUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0dBQ2hEOztBQUVELFdBQVMsRUFBQSxZQUFHLEVBR1g7O0FBRUQsWUFBVSxFQUFBLFlBQUcsRUFHWjs7QUFFRCxjQUFZLEVBQUEsZ0JBQVU7UUFBUCxHQUFHLFFBQUgsR0FBRztBQUNoQixRQUFHLElBQUksQ0FBQyxHQUFHLEtBQUssSUFBSSxJQUFJLEdBQUcsS0FBSyxJQUFJLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQywyQkFBMkIsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUU7QUFDNUYsWUFB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LEVBQUUsSUFBSTtBQUNULFdBQVMsRUFBRSxJQUFJO0FBQ2YsNkJBQTJCLEVBQUUsSUFBSTtBQUNqQyxlQUFhLEVBQUUsSUFBSTtBQUNuQixPQUFLLEVBQUUsSUFBSSxFQUNaLENBQUMsQ0FBQzs7QUFFSCxNQUFNLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyIsImZpbGUiOiJVcGxpbmsuanMiLCJzb3VyY2VzQ29udGVudCI6WyJyZXF1aXJlKCc2dG81L3BvbHlmaWxsJyk7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJ2JsdWViaXJkJyk7XG5jb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcblxuY29uc3QgaW8gPSByZXF1aXJlKCdzb2NrZXQuaW8tY2xpZW50Jyk7XG5jb25zdCByZWxhdGl2ZSA9IHJlcXVpcmUoJ3VybCcpLnJlc29sdmU7XG5jb25zdCByZXF1ZXN0ID0gXy5pc1NlcnZlcigpID8gcmVxdWlyZSgncmVxdWVzdCcpIDogcmVxdWlyZSgnYnJvd3Nlci1yZXF1ZXN0Jyk7XG5cbmNvbnN0IExpc3RlbmVyID0gcmVxdWlyZSgnLi9MaXN0ZW5lcicpO1xuY29uc3QgU3Vic2NyaXB0aW9uID0gcmVxdWlyZSgnLi9TdWJzY3JpcHRpb24nKTtcblxuLy8gVGhlc2Ugc29ja2V0LmlvIGhhbmRsZXJzIGFyZSBhY3R1YWxseSBjYWxsZWQgbGlrZSBVcGxpbmsgaW5zdGFuY2UgbWV0aG9kXG4vLyAodXNpbmcgLmNhbGwpLiBJbiB0aGVpciBib2R5ICd0aGlzJyBpcyB0aGVyZWZvcmUgYW4gVXBsaW5rIGluc3RhbmNlLlxuLy8gVGhleSBhcmUgZGVjbGFyZWQgaGVyZSB0byBhdm9pZCBjbHV0dGVyaW5nIHRoZSBVcGxpbmsgY2xhc3MgZGVmaW5pdGlvblxuLy8gYW5kIG1ldGhvZCBuYW1pbmcgY29sbGlzaW9ucy5cbmNvbnN0IGlvSGFuZGxlcnMgPSB7XG4gIGNvbm5lY3QoKSB7XG4gICAgdGhpcy5pby5lbWl0KCdoYW5kc2hha2UnLCB7IGd1aWQ6IHRoaXMuZ3VpZCB9KTtcbiAgfSxcblxuICByZWNvbm5lY3QoKSB7XG4gICAgLy8gVE9ET1xuICAgIC8vIEhhbmRsZSByZWNvbm5lY3Rpb25zIHByb3Blcmx5LlxuICB9LFxuXG4gIGRpc2Nvbm5lY3QoKSB7XG4gICAgLy8gVE9ET1xuICAgIC8vIEhhbmRsZSBkaXNjb25uZWN0aW9ucyBwcm9wZXJseVxuICB9LFxuXG4gIGhhbmRzaGFrZUFjayh7IHBpZCB9KSB7XG4gICAgaWYodGhpcy5waWQgIT09IG51bGwgJiYgcGlkICE9PSB0aGlzLnBpZCAmJiB0aGlzLnNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCAmJiBfLmlzQ2xpZW50KCkpIHtcbiAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICB9XG4gICAgdGhpcy5waWQgPSBwaWQ7XG4gICAgdGhpcy5faGFuZHNoYWtlKHsgcGlkIH0pO1xuICB9LFxuXG4gIHVwZGF0ZSh7IHBhdGgsIGRpZmYsIGhhc2ggfSkge1xuICAgIC8vIEF0IHRoZSB1cGxpbmsgbGV2ZWwsIHVwZGF0ZXMgYXJlIHRyYW5zbWl0dGVkXG4gICAgLy8gYXMgKGRpZmYsIGhhc2gpLiBJZiB0aGUgdXBsaW5rIGNsaWVudCBoYXNcbiAgICAvLyBhIGNhY2hlZCB2YWx1ZSB3aXRoIHRoZSBtYXRjaGluZyBoYXNoLCB0aGVuXG4gICAgLy8gdGhlIGRpZmYgaXMgYXBwbGllZC4gSWYgbm90LCB0aGVuIHRoZSBmdWxsIHZhbHVlXG4gICAgLy8gaXMgZmV0Y2hlZC5cbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgaWYoIXRoaXMuc3RvcmVbcGF0aF0pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYodGhpcy5zdG9yZVtwYXRoXS5oYXNoID09PSBoYXNoKSB7XG4gICAgICB0aGlzLnN0b3JlW3BhdGhdLnZhbHVlID0gXy5wYXRjaCh0aGlzLnN0b3JlW3BhdGhdLCBkaWZmKTtcbiAgICAgIHRoaXMuc3RvcmVbcGF0aF0uaGFzaCA9IF8uaGFzaCh0aGlzLnN0b3JlW3BhdGhdLnZhbHVlKTtcbiAgICAgIHRoaXMudXBkYXRlKHBhdGgsIHRoaXMuc3RvcmVbcGF0aF0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMucHVsbChwYXRoLCB7IGJ5cGFzc0NhY2hlOiB0cnVlIH0pXG4gICAgICAudGhlbigodmFsdWUpID0+IHRoaXMuc3RvcmVbcGF0aF0gPSB7IHZhbHVlLCBoYXNoOiBfLmhhc2godmFsdWUpIH0pXG4gICAgICAudGhlbigoKSA9PiB0aGlzLnVwZGF0ZShwYXRoLCB0aGlzLnN0b3JlW3BhdGhdKSk7XG4gICAgfVxuICB9LFxuXG4gIGVtaXQoeyByb29tLCBwYXJhbXMgfSkge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0KTtcbiAgICB0aGlzLmVtaXQocm9vbSwgcGFyYW1zKTtcblxuICB9LFxuXG4gIGRlYnVnKC4uLmFyZ3MpIHtcbiAgICBjb25zb2xlLnRhYmxlKC4uLmFyZ3MpO1xuICB9LFxuXG4gIGxvZyguLi5hcmdzKSB7XG4gICAgY29uc29sZS5sb2coLi4uYXJncyk7XG4gIH0sXG5cbiAgd2FybiguLi5hcmdzKSB7XG4gICAgY29uc29sZS53YXJuKC4uLmFyZ3MpO1xuICB9LFxuXG4gIGVyciguLi5hcmdzKSB7XG4gICAgY29uc29sZS5lcnJvciguLi5hcmdzKTtcbiAgfSxcbn07XG5cbmNsYXNzIFVwbGluayB7XG4gIGNvbnN0cnVjdG9yKHsgdXJsLCBndWlkLCBzaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQgfSkge1xuICAgIF8uZGV2KCgpID0+IHVybC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nXG4gICAgKTtcbiAgICB0aGlzLmh0dHAgPSB1cmw7XG4gICAgdGhpcy5pbyA9IGlvKHVybCk7XG4gICAgdGhpcy5waWQgPSBudWxsO1xuICAgIHRoaXMuZ3VpZCA9IGd1aWQ7XG4gICAgdGhpcy5zaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQgPSBzaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQ7XG4gICAgdGhpcy5oYW5kc2hha2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB0aGlzLl9oYW5kc2hha2UgPSB7IHJlc29sdmUsIHJlamVjdCB9KS5jYW5jZWxsYWJsZSgpO1xuICAgIHRoaXMubGlzdGVuZXJzID0ge307XG4gICAgdGhpcy5zdWJzY3JpcHRpb25zID0ge307XG4gICAgdGhpcy5zdG9yZSA9IHt9O1xuICAgIHRoaXMucGVuZGluZyA9IHt9O1xuICAgIHRoaXMuYmluZElPSGFuZGxlcnMoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgLy8gQ2FuY2VsIGFsbCBwZW5kaW5nIHJlcXVlc3RzL2FjdGl2ZSBzdWJzY3JpcHRpb25zL2xpc3RlbmVyc1xuICAgIGlmKCF0aGlzLmhhbmRzaGFrZS5pc1Jlc29sdmVkKCkpIHtcbiAgICAgIHRoaXMuaGFuZHNoYWtlLmNhbmNlbCgpO1xuICAgIH1cbiAgICBPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmlwdGlvbnMpXG4gICAgLmZvckVhY2goKHBhdGgpID0+IE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXSlcbiAgICAgIC5mb3JFYWNoKChpZCkgPT4gdGhpcy51bnN1YnNjcmliZUZyb20odGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdW2lkXSkpXG4gICAgKTtcbiAgICBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVycylcbiAgICAuZm9yRWFjaCgocm9vbSkgPT4gT2JqZWN0LmtleXModGhpcy5saXN0ZW5lcnNbcm9vbV0pXG4gICAgICAuZm9yRWFjaCgoaWQpID0+IHRoaXMudW5saXN0ZW5Gcm9tKHRoaXMubGlzdGVuZXJzW3Jvb21dW2lkXSkpXG4gICAgKTtcbiAgICBPYmplY3Qua2V5cyh0aGlzLnBlbmRpbmcpXG4gICAgLmZvckVhY2goKHBhdGgpID0+IHtcbiAgICAgIHRoaXMucGVuZGluZ1twYXRoXS5jYW5jZWwoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLnBlbmRpbmdbcGF0aF07XG4gICAgfSk7XG4gICAgdGhpcy5pby5jbG9zZSgpO1xuICB9XG5cbiAgYmluZElPSGFuZGxlcnMoKSB7XG4gICAgT2JqZWN0LmtleXMoaW9IYW5kbGVycylcbiAgICAuZm9yRWFjaCgoZXZlbnQpID0+IHRoaXMuaW8ub24oZXZlbnQsIChqc29uUGFyYW1zKSA9PiBpb0hhbmRsZXJzW2V2ZW50XS5jYWxsKHRoaXMsIEpTT04ucGFyc2UoanNvblBhcmFtcyB8fCAne30nKSkpKTtcbiAgfVxuXG4gIHB1c2goZXZlbnQsIHBhcmFtcykge1xuICAgIHRoaXMuaW8uZW1pdChldmVudCwgcGFyYW1zKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1bGwocGF0aCwgb3B0cyA9IHt9KSB7XG4gICAgbGV0IHsgYnlwYXNzQ2FjaGUgfSA9IG9wdHM7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGlmKCF0aGlzLnBlbmRpbmdbcGF0aF0gfHwgYnlwYXNzQ2FjaGUpIHtcbiAgICAgIHRoaXMucGVuZGluZ1twYXRoXSA9IHRoaXMuZmV0Y2gocGF0aCkuY2FuY2VsbGFibGUoKS50aGVuKCh2YWx1ZSkgPT4ge1xuICAgICAgICAvLyBBcyBzb29uIGFzIHRoZSByZXN1bHQgaXMgcmVjZWl2ZWQsIHJlbW92ZWQgZnJvbSB0aGUgcGVuZGluZyBsaXN0LlxuICAgICAgICBkZWxldGUgdGhpcy5wZW5kaW5nW3BhdGhdO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9KTtcbiAgICB9XG4gICAgXy5kZXYoKCkgPT4gdGhpcy5wZW5kaW5nW3BhdGhdLnRoZW4uc2hvdWxkLmJlLmEuRnVuY3Rpb24pO1xuICAgIHJldHVybiB0aGlzLnBlbmRpbmdbcGF0aF07XG4gIH1cblxuICBmZXRjaChwYXRoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+XG4gICAgICByZXF1ZXN0KHsgbWV0aG9kOiAnR0VUJywgdXJsOiByZWxhdGl2ZSh0aGlzLmh0dHAsIHBhdGgpLCBqc29uOiB0cnVlIH0sIChlcnIsIHJlcywgYm9keSkgPT4gZXJyID8gcmVqZWN0KGVycikgOiByZXNvbHZlKGJvZHkpKVxuICAgICk7XG4gIH1cblxuICBkaXNwYXRjaChhY3Rpb24sIHBhcmFtcykge1xuICAgIF8uZGV2KCgpID0+IGFjdGlvbi5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0XG4gICAgKTtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT5cbiAgICAgIHJlcXVlc3QoeyBtZXRob2Q6ICdQT1NUJywgdXJsOiByZWxhdGl2ZSh0aGlzLmh0dHAsIGFjdGlvbiksIGpzb246IHRydWUsIGJvZHk6IF8uZXh0ZW5kKHt9LCBwYXJhbXMsIHsgZ3VpZDogdGhpcy5ndWlkIH0pIH0sIChlcnIsIHJlcywgYm9keSkgPT4gZXJyID8gcmVqZWN0KGVycikgOiByZXNvbHZlKGJvZHkpKVxuICAgICk7XG4gIH1cblxuICBfcmVtb3RlU3Vic2NyaWJlVG8ocGF0aCkge1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICB0aGlzLnN0b3JlW3BhdGhdID0geyB2YWx1ZTogbnVsbCwgaGFzaDogbnVsbCB9O1xuICAgIHRoaXMuaW8uZW1pdCgnc3Vic2NyaWJlVG8nLCB7IHBhdGggfSk7XG4gIH1cblxuICBfcmVtb3RlVW5zdWJzY3JpYmVGcm9tKHBhdGgpIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgdGhpcy5pby5lbWl0KCd1bnN1YnNjcmliZUZyb20nLCB7IHBhdGggfSk7XG4gICAgZGVsZXRlIHRoaXMuc3RvcmVbcGF0aF07XG4gIH1cblxuICBzdWJzY3JpYmVUbyhwYXRoLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGhhbmRsZXIuc2hvdWxkLmJlLmEuRnVuY3Rpb25cbiAgICApO1xuICAgIGxldCBzdWJzY3JpcHRpb24gPSBuZXcgU3Vic2NyaXB0aW9uKHsgcGF0aCwgaGFuZGxlciB9KTtcbiAgICBsZXQgY3JlYXRlZFBhdGggPSBzdWJzY3JpcHRpb24uYWRkVG8odGhpcy5zdWJzY3JpcHRpb25zKTtcbiAgICBpZihjcmVhdGVkUGF0aCkge1xuICAgICAgdGhpcy5fcmVtb3RlU3Vic2NyaWJlVG8ocGF0aCk7XG4gICAgfVxuICAgIHJldHVybiB7IHN1YnNjcmlwdGlvbiwgY3JlYXRlZFBhdGggfTtcbiAgfVxuXG4gIHVuc3Vic2NyaWJlRnJvbShzdWJzY3JpcHRpb24pIHtcbiAgICBfLmRldigoKSA9PiBzdWJzY3JpcHRpb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU3Vic2NyaXB0aW9uKSk7XG4gICAgbGV0IGRlbGV0ZWRQYXRoID0gc3Vic2NyaXB0aW9uLnJlbW92ZUZyb20odGhpcy5zdWJzY3JpcHRpb25zKTtcbiAgICBpZihkZWxldGVkUGF0aCkge1xuICAgICAgdGhpcy5fcmVtb3RlVW5zdWJzY3JpYmVGcm9tKHN1YnNjcmlwdGlvbi5wYXRoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN0b3JlW3N1YnNjcmlwdGlvbi5wYXRoXTtcbiAgICB9XG4gICAgcmV0dXJuIHsgc3Vic2NyaXB0aW9uLCBkZWxldGVkUGF0aCB9O1xuICB9XG5cbiAgdXBkYXRlKHBhdGgsIHZhbHVlKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICh2YWx1ZSA9PT0gbnVsbCB8fCBfLmlzT2JqZWN0KHZhbHVlKSkuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICBpZih0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF0pIHtcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXSlcbiAgICAgIC5mb3JFYWNoKChrZXkpID0+IHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXVtrZXldLnVwZGF0ZSh2YWx1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIF9yZW1vdGVMaXN0ZW5Ubyhyb29tKSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIHRoaXMuaW8uZW1pdCgnbGlzdGVuVG8nLCB7IHJvb20gfSk7XG4gIH1cblxuICBfcmVtb3RlVW5saXN0ZW5Gcm9tKHJvb20pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgdGhpcy5pby5lbWl0KCd1bmxpc3RlbkZyb20nLCB7IHJvb20gfSk7XG4gIH1cblxuICBsaXN0ZW5Ubyhyb29tLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGhhbmRsZXIuc2hvdWxkLmJlLmEuRnVuY3Rpb25cbiAgICApO1xuICAgIGxldCBsaXN0ZW5lciA9IG5ldyBMaXN0ZW5lcih7IHJvb20sIGhhbmRsZXIgfSk7XG4gICAgbGV0IGNyZWF0ZWRSb29tID0gbGlzdGVuZXIuYWRkVG8odGhpcy5saXN0ZW5lcnMpO1xuICAgIGlmKGNyZWF0ZWRSb29tKSB7XG4gICAgICB0aGlzLl9yZW1vdGVMaXN0ZW5Ubyhyb29tKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgbGlzdGVuZXIsIGNyZWF0ZWRSb29tIH07XG4gIH1cblxuICB1bmxpc3RlbkZyb20obGlzdGVuZXIpIHtcbiAgICBfLmRldigoKSA9PiBsaXN0ZW5lci5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihMaXN0ZW5lcikpO1xuICAgIGxldCBkZWxldGVkUm9vbSA9IGxpc3RlbmVyLnJlbW92ZUZyb20odGhpcy5saXN0ZW5lcnMpO1xuICAgIGlmKGRlbGV0ZWRSb29tKSB7XG4gICAgICB0aGlzLl9yZW1vdGVVbmxpc3RlbkZyb20obGlzdGVuZXIucm9vbSk7XG4gICAgfVxuICAgIHJldHVybiB7IGxpc3RlbmVyLCBkZWxldGVkUm9vbSB9O1xuICB9XG5cbiAgZW1pdChyb29tLCBwYXJhbXMpIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3RcbiAgICApO1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3Jvb21dKSB7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSlcbiAgICAgIC5mb3JFYWNoKChrZXkpID0+IHRoaXMubGlzdGVuZXJzW3Jvb21dW2tleV0uZW1pdChwYXJhbXMpKTtcbiAgICB9XG4gIH1cbn1cblxuXy5leHRlbmQoVXBsaW5rLnByb3RvdHlwZSwge1xuICBndWlkOiBudWxsLFxuICBoYW5kc2hha2U6IG51bGwsXG4gIF9oYW5kc2hha2U6IG51bGwsXG4gIGlvOiBudWxsLFxuICBwaWQ6IG51bGwsXG4gIGxpc3RlbmVyczogbnVsbCxcbiAgc2hvdWxkUmVsb2FkT25TZXJ2ZXJSZXN0YXJ0OiBudWxsLFxuICBzdWJzY3JpcHRpb25zOiBudWxsLFxuICBzdG9yZTogbnVsbCxcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVwbGluaztcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==