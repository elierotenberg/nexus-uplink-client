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
var should = _.should;

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
    this._handshake({ pid: pid, guid: guid });
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
            return ioHandlers[event].call(_this4, JSON.parse(params));
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
          return request({ method: "POST", url: relative(_this7.http, path), json: true, body: _.extend({}, params, { guid: _this7.guid }) }, function (err, res, body) {
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
          delete this.store[path];
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
        var deletedRoom = subscription.removeFrom(this.listeners);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImc6L3JlYWN0LW5leHVzL25leHVzLXVwbGluay1jbGllbnQvc3JjL1VwbGluay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEMsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDOztBQUVqQyxJQUFNLEVBQUUsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUN2QyxJQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDO0FBQ3hDLElBQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFDL0UsSUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQzs7QUFFeEIsSUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3ZDLElBQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDOzs7Ozs7QUFNL0MsSUFBTSxVQUFVLEdBQUc7QUFDakIsU0FBTyxFQUFBLFlBQUc7QUFDUixRQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7R0FDaEQ7O0FBRUQsV0FBUyxFQUFBLFlBQUcsRUFHWDs7QUFFRCxZQUFVLEVBQUEsWUFBRyxFQUdaOztBQUVELGNBQVksRUFBQSxnQkFBVTtRQUFQLEdBQUcsUUFBSCxHQUFHO0FBQ2hCLFFBQUcsSUFBSSxDQUFDLEdBQUcsS0FBSyxJQUFJLElBQUksR0FBRyxLQUFLLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLDJCQUEyQixJQUFJLENB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STtBQUNoQixJQUFFLEVBQUUsSUFBSTtBQUNSLEtBQUcsRUFBRSxJQUFJO0FBQ1QsV0FBUyxFQUFFLElBQUk7QUFDZiw2QkFBMkIsRUFBRSxJQUFJO0FBQ2pDLGVBQWEsRUFBRSxJQUFJO0FBQ25CLE9BQUssRUFBRSxJQUFJLEVBQ1osQ0FBQyxDQUFDOztBQUVILE1BQU0sQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDIiwiZmlsZSI6IlVwbGluay5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbmNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xyXG5cclxuY29uc3QgaW8gPSByZXF1aXJlKCdzb2NrZXQuaW8tY2xpZW50Jyk7XHJcbmNvbnN0IHJlbGF0aXZlID0gcmVxdWlyZSgndXJsJykucmVzb2x2ZTtcclxuY29uc3QgcmVxdWVzdCA9IF8uaXNTZXJ2ZXIoKSA/IHJlcXVpcmUoJ3JlcXVlc3QnKSA6IHJlcXVpcmUoJ2Jyb3dzZXItcmVxdWVzdCcpO1xyXG5jb25zdCBzaG91bGQgPSBfLnNob3VsZDtcclxuXHJcbmNvbnN0IExpc3RlbmVyID0gcmVxdWlyZSgnLi9MaXN0ZW5lcicpO1xyXG5jb25zdCBTdWJzY3JpcHRpb24gPSByZXF1aXJlKCcuL1N1YnNjcmlwdGlvbicpO1xyXG5cclxuLy8gVGhlc2Ugc29ja2V0LmlvIGhhbmRsZXJzIGFyZSBhY3R1YWxseSBjYWxsZWQgbGlrZSBVcGxpbmsgaW5zdGFuY2UgbWV0aG9kXHJcbi8vICh1c2luZyAuY2FsbCkuIEluIHRoZWlyIGJvZHkgJ3RoaXMnIGlzIHRoZXJlZm9yZSBhbiBVcGxpbmsgaW5zdGFuY2UuXHJcbi8vIFRoZXkgYXJlIGRlY2xhcmVkIGhlcmUgdG8gYXZvaWQgY2x1dHRlcmluZyB0aGUgVXBsaW5rIGNsYXNzIGRlZmluaXRpb25cclxuLy8gYW5kIG1ldGhvZCBuYW1pbmcgY29sbGlzaW9ucy5cclxuY29uc3QgaW9IYW5kbGVycyA9IHtcclxuICBjb25uZWN0KCkge1xyXG4gICAgdGhpcy5pby5lbWl0KCdoYW5kc2hha2UnLCB7IGd1aWQ6IHRoaXMuZ3VpZCB9KTtcclxuICB9LFxyXG5cclxuICByZWNvbm5lY3QoKSB7XHJcbiAgICAvLyBUT0RPXHJcbiAgICAvLyBIYW5kbGUgcmVjb25uZWN0aW9ucyBwcm9wZXJseS5cclxuICB9LFxyXG5cclxuICBkaXNjb25uZWN0KCkge1xyXG4gICAgLy8gVE9ET1xyXG4gICAgLy8gSGFuZGxlIGRpc2Nvbm5lY3Rpb25zIHByb3Blcmx5XHJcbiAgfSxcclxuXHJcbiAgaGFuZHNoYWtlQWNrKHsgcGlkIH0pIHtcclxuICAgIGlmKHRoaXMucGlkICE9PSBudWxsICYmIHBpZCAhPT0gdGhpcy5waWQgJiYgdGhpcy5zaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQgJiYgXy5pc0NsaWVudCgpKSB7XHJcbiAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcclxuICAgIH1cclxuICAgIHRoaXMucGlkID0gcGlkO1xyXG4gICAgdGhpcy5faGFuZHNoYWtlKHsgcGlkLCBndWlkIH0pO1xyXG4gIH0sXHJcblxyXG4gIHVwZGF0ZSh7IHBhdGgsIGRpZmYsIGhhc2ggfSkge1xyXG4gICAgLy8gQXQgdGhlIHVwbGluayBsZXZlbCwgdXBkYXRlcyBhcmUgdHJhbnNtaXR0ZWRcclxuICAgIC8vIGFzIChkaWZmLCBoYXNoKS4gSWYgdGhlIHVwbGluayBjbGllbnQgaGFzXHJcbiAgICAvLyBhIGNhY2hlZCB2YWx1ZSB3aXRoIHRoZSBtYXRjaGluZyBoYXNoLCB0aGVuXHJcbiAgICAvLyB0aGUgZGlmZiBpcyBhcHBsaWVkLiBJZiBub3QsIHRoZW4gdGhlIGZ1bGwgdmFsdWVcclxuICAgIC8vIGlzIGZldGNoZWQuXHJcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyk7XHJcbiAgICBpZighdGhpcy5zdG9yZVtwYXRoXSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZih0aGlzLnN0b3JlW3BhdGhdLmhhc2ggPT09IGhhc2gpIHtcclxuICAgICAgdGhpcy5zdG9yZVtwYXRoXS52YWx1ZSA9IF8ucGF0Y2godGhpcy5zdG9yZVtwYXRoXSwgZGlmZik7XHJcbiAgICAgIHRoaXMuc3RvcmVbcGF0aF0uaGFzaCA9IF8uaGFzaCh0aGlzLnN0b3JlW3BhdGhdLnZhbHVlKTtcclxuICAgICAgdGhpcy51cGRhdGUocGF0aCwgdGhpcy5zdG9yZVtwYXRoXSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgdGhpcy5wdWxsKHBhdGgsIHsgYnlwYXNzQ2FjaGU6IHRydWUgfSlcclxuICAgICAgLnRoZW4oKHZhbHVlKSA9PiB0aGlzLnN0b3JlW3BhdGhdID0geyB2YWx1ZSwgaGFzaDogXy5oYXNoKHZhbHVlKSB9KVxyXG4gICAgICAudGhlbigoKSA9PiB0aGlzLnVwZGF0ZShwYXRoLCB0aGlzLnN0b3JlW3BhdGhdKSk7XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgZW1pdCh7IHJvb20sIHBhcmFtcyB9KSB7XHJcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJiBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdCk7XHJcbiAgICB0aGlzLmVtaXQocm9vbSwgcGFyYW1zKTtcclxuXHJcbiAgfSxcclxuXHJcbiAgZGVidWcoLi4uYXJncykge1xyXG4gICAgY29uc29sZS50YWJsZSguLi5hcmdzKTtcclxuICB9LFxyXG5cclxuICBsb2coLi4uYXJncykge1xyXG4gICAgY29uc29sZS5sb2coLi4uYXJncyk7XHJcbiAgfSxcclxuXHJcbiAgd2FybiguLi5hcmdzKSB7XHJcbiAgICBjb25zb2xlLndhcm4oLi4uYXJncyk7XHJcbiAgfSxcclxuXHJcbiAgZXJyKC4uLmFyZ3MpIHtcclxuICAgIGNvbnNvbGUuZXJyb3IoLi4uYXJncyk7XHJcbiAgfSxcclxufTtcclxuXHJcbmNsYXNzIFVwbGluayB7XHJcbiAgY29uc3RydWN0b3IoeyB1cmwsIGd1aWQsIHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCB9KSB7XHJcbiAgICBfLmRldigoKSA9PiB1cmwuc2hvdWxkLmJlLmEuU3RyaW5nICYmXHJcbiAgICAgIGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nXHJcbiAgICApO1xyXG4gICAgdGhpcy5odHRwID0gdXJsO1xyXG4gICAgdGhpcy5pbyA9IGlvKHVybCk7XHJcbiAgICB0aGlzLnBpZCA9IG51bGw7XHJcbiAgICB0aGlzLmd1aWQgPSBndWlkO1xyXG4gICAgdGhpcy5zaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQgPSBzaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQ7XHJcbiAgICB0aGlzLmhhbmRzaGFrZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHRoaXMuX2hhbmRzaGFrZSA9IHsgcmVzb2x2ZSwgcmVqZWN0IH0pLmNhbmNlbGxhYmxlKCk7XHJcbiAgICB0aGlzLmxpc3RlbmVycyA9IHt9O1xyXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zID0ge307XHJcbiAgICB0aGlzLnN0b3JlID0ge307XHJcbiAgICB0aGlzLnBlbmRpbmcgPSB7fTtcclxuICAgIHRoaXMuYmluZElPSGFuZGxlcnMoKTtcclxuICB9XHJcblxyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICAvLyBDYW5jZWwgYWxsIHBlbmRpbmcgcmVxdWVzdHMvYWN0aXZlIHN1YnNjcmlwdGlvbnMvbGlzdGVuZXJzXHJcbiAgICBpZighdGhpcy5oYW5kc2hha2UuaXNSZXNvbHZlZCgpKSB7XHJcbiAgICAgIHRoaXMuaGFuZHNoYWtlLmNhbmNlbCgpO1xyXG4gICAgfVxyXG4gICAgT2JqZWN0LmtleXModGhpcy5zdWJzY3JpcHRpb25zKVxyXG4gICAgLmZvckVhY2goKHBhdGgpID0+IE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXSlcclxuICAgICAgLmZvckVhY2goKGlkKSA9PiB0aGlzLnVuc3Vic2NyaWJlRnJvbSh0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF1baWRdKSlcclxuICAgICk7XHJcbiAgICBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVycylcclxuICAgIC5mb3JFYWNoKChyb29tKSA9PiBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSlcclxuICAgICAgLmZvckVhY2goKGlkKSA9PiB0aGlzLnVubGlzdGVuRnJvbSh0aGlzLmxpc3RlbmVyc1tyb29tXVtpZF0pKVxyXG4gICAgKTtcclxuICAgIE9iamVjdC5rZXlzKHRoaXMucGVuZGluZylcclxuICAgIC5mb3JFYWNoKChwYXRoKSA9PiB7XHJcbiAgICAgIHRoaXMucGVuZGluZ1twYXRoXS5jYW5jZWwoKTtcclxuICAgICAgZGVsZXRlIHRoaXMucGVuZGluZ1twYXRoXTtcclxuICAgIH0pO1xyXG4gICAgdGhpcy5pby5jbG9zZSgpO1xyXG4gIH1cclxuXHJcbiAgYmluZElPSGFuZGxlcnMoKSB7XHJcbiAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxyXG4gICAgLmZvckVhY2goKGV2ZW50KSA9PiB0aGlzLmlvLm9uKGV2ZW50LCAoanNvblBhcmFtcykgPT4gaW9IYW5kbGVyc1tldmVudF0uY2FsbCh0aGlzLCBKU09OLnBhcnNlKHBhcmFtcykpKSk7XHJcbiAgfVxyXG5cclxuICBwdXNoKGV2ZW50LCBwYXJhbXMpIHtcclxuICAgIHRoaXMuaW8uZW1pdChldmVudCwgcGFyYW1zKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgcHVsbChwYXRoLCBvcHRzID0ge30pIHtcclxuICAgIGxldCB7IGJ5cGFzc0NhY2hlIH0gPSBvcHRzO1xyXG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcpO1xyXG4gICAgaWYoIXRoaXMucGVuZGluZ1twYXRoXSB8fCBieXBhc3NDYWNoZSkge1xyXG4gICAgICB0aGlzLnBlbmRpbmdbcGF0aF0gPSB0aGlzLmZldGNoKHBhdGgpLmNhbmNlbGxhYmxlKCkudGhlbigodmFsdWUpID0+IHtcclxuICAgICAgICAvLyBBcyBzb29uIGFzIHRoZSByZXN1bHQgaXMgcmVjZWl2ZWQsIHJlbW92ZWQgZnJvbSB0aGUgcGVuZGluZyBsaXN0LlxyXG4gICAgICAgIGRlbGV0ZSB0aGlzLnBlbmRpbmdbcGF0aF07XHJcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIF8uZGV2KCgpID0+IHRoaXMucGVuZGluZ1twYXRoXS50aGVuLnNob3VsZC5iZS5hLkZ1bmN0aW9uKTtcclxuICAgIHJldHVybiB0aGlzLnBlbmRpbmdbcGF0aF07XHJcbiAgfVxyXG5cclxuICBmZXRjaChwYXRoKSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT5cclxuICAgICAgcmVxdWVzdCh7IG1ldGhvZDogJ0dFVCcsIHVybDogcmVsYXRpdmUodGhpcy5odHRwLCBwYXRoKSwganNvbjogdHJ1ZSB9LCAoZXJyLCByZXMsIGJvZHkpID0+IGVyciA/IHJlamVjdChlcnIpIDogcmVzb2x2ZShib2R5KSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBkaXNwYXRjaChhY3Rpb24sIHBhcmFtcykge1xyXG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxyXG4gICAgICBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdFxyXG4gICAgKTtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PlxyXG4gICAgICByZXF1ZXN0KHsgbWV0aG9kOiAnUE9TVCcsIHVybDogcmVsYXRpdmUodGhpcy5odHRwLCBwYXRoKSwganNvbjogdHJ1ZSwgYm9keTogXy5leHRlbmQoe30sIHBhcmFtcywgeyBndWlkOiB0aGlzLmd1aWQgfSkgfSwgKGVyciwgcmVzLCBib2R5KSA9PiBlcnIgPyByZWplY3QoZXJyKSA6IHJlc29sdmUoYm9keSkpXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgX3JlbW90ZVN1YnNjcmliZVRvKHBhdGgpIHtcclxuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nKTtcclxuICAgIHRoaXMuc3RvcmVbcGF0aF0gPSB7IHZhbHVlOiBudWxsLCBoYXNoOiBudWxsIH07XHJcbiAgICB0aGlzLmlvLmVtaXQoJ3N1YnNjcmliZVRvJywgeyBwYXRoIH0pO1xyXG4gIH1cclxuXHJcbiAgX3JlbW90ZVVuc3Vic2NyaWJlRnJvbShwYXRoKSB7XHJcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyk7XHJcbiAgICB0aGlzLmlvLmVtaXQoJ3Vuc3Vic2NyaWJlRnJvbScsIHsgcGF0aCB9KTtcclxuICAgIGRlbGV0ZSB0aGlzLnN0b3JlW3BhdGhdO1xyXG4gIH1cclxuXHJcbiAgc3Vic2NyaWJlVG8ocGF0aCwgaGFuZGxlcikge1xyXG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcclxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvblxyXG4gICAgKTtcclxuICAgIGxldCBzdWJzY3JpcHRpb24gPSBuZXcgU3Vic2NyaXB0aW9uKHsgcGF0aCwgaGFuZGxlciB9KTtcclxuICAgIGxldCBjcmVhdGVkUGF0aCA9IHN1YnNjcmlwdGlvbi5hZGRUbyh0aGlzLnN1YnNjcmlwdGlvbnMpO1xyXG4gICAgaWYoY3JlYXRlZFBhdGgpIHtcclxuICAgICAgdGhpcy5fcmVtb3RlU3Vic2NyaWJlVG8ocGF0aCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4geyBzdWJzY3JpcHRpb24sIGNyZWF0ZWRQYXRoIH07XHJcbiAgfVxyXG5cclxuICB1bnN1YnNjcmliZUZyb20oc3Vic2NyaXB0aW9uKSB7XHJcbiAgICBfLmRldigoKSA9PiBzdWJzY3JpcHRpb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU3Vic2NyaXB0aW9uKSk7XHJcbiAgICBsZXQgZGVsZXRlZFBhdGggPSBzdWJzY3JpcHRpb24ucmVtb3ZlRnJvbSh0aGlzLnN1YnNjcmlwdGlvbnMpO1xyXG4gICAgaWYoZGVsZXRlZFBhdGgpIHtcclxuICAgICAgdGhpcy5fcmVtb3RlVW5zdWJzY3JpYmVGcm9tKHN1YnNjcmlwdGlvbi5wYXRoKTtcclxuICAgICAgZGVsZXRlIHRoaXMuc3RvcmVbcGF0aF07XHJcbiAgICB9XHJcbiAgICByZXR1cm4geyBzdWJzY3JpcHRpb24sIGRlbGV0ZWRQYXRoIH07XHJcbiAgfVxyXG5cclxuICB1cGRhdGUocGF0aCwgdmFsdWUpIHtcclxuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXHJcbiAgICAgICh2YWx1ZSA9PT0gbnVsbCB8fCBfLmlzT2JqZWN0KHZhbHVlKSkuc2hvdWxkLmJlLm9rXHJcbiAgICApO1xyXG4gICAgaWYodGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdKSB7XHJcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXSlcclxuICAgICAgLmZvckVhY2goKGtleSkgPT4gdGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdW2tleV0udXBkYXRlKHZhbHVlKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBfcmVtb3RlTGlzdGVuVG8ocm9vbSkge1xyXG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcpO1xyXG4gICAgdGhpcy5pby5lbWl0KCdsaXN0ZW5UbycsIHsgcm9vbSB9KTtcclxuICB9XHJcblxyXG4gIF9yZW1vdGVVbmxpc3RlbkZyb20ocm9vbSkge1xyXG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcpO1xyXG4gICAgdGhpcy5pby5lbWl0KCd1bmxpc3RlbkZyb20nLCB7IHJvb20gfSk7XHJcbiAgfVxyXG5cclxuICBsaXN0ZW5Ubyhyb29tLCBoYW5kbGVyKSB7XHJcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxyXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uXHJcbiAgICApO1xyXG4gICAgbGV0IGxpc3RlbmVyID0gbmV3IExpc3RlbmVyKHsgcm9vbSwgaGFuZGxlciB9KTtcclxuICAgIGxldCBjcmVhdGVkUm9vbSA9IGxpc3RlbmVyLmFkZFRvKHRoaXMubGlzdGVuZXJzKTtcclxuICAgIGlmKGNyZWF0ZWRSb29tKSB7XHJcbiAgICAgIHRoaXMuX3JlbW90ZUxpc3RlblRvKHJvb20pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHsgbGlzdGVuZXIsIGNyZWF0ZWRSb29tIH07XHJcbiAgfVxyXG5cclxuICB1bmxpc3RlbkZyb20obGlzdGVuZXIpIHtcclxuICAgIF8uZGV2KCgpID0+IGxpc3RlbmVyLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKExpc3RlbmVyKSk7XHJcbiAgICBsZXQgZGVsZXRlZFJvb20gPSBzdWJzY3JpcHRpb24ucmVtb3ZlRnJvbSh0aGlzLmxpc3RlbmVycyk7XHJcbiAgICBpZihkZWxldGVkUm9vbSkge1xyXG4gICAgICB0aGlzLl9yZW1vdGVVbmxpc3RlbkZyb20obGlzdGVuZXIucm9vbSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4geyBsaXN0ZW5lciwgZGVsZXRlZFJvb20gfTtcclxuICB9XHJcblxyXG4gIGVtaXQocm9vbSwgcGFyYW1zKSB7XHJcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxyXG4gICAgICBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdFxyXG4gICAgKTtcclxuICAgIGlmKHRoaXMubGlzdGVuZXJzW3Jvb21dKSB7XHJcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKVxyXG4gICAgICAuZm9yRWFjaCgoa2V5KSA9PiB0aGlzLmxpc3RlbmVyc1tyb29tXVtrZXldLmVtaXQocGFyYW1zKSk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5fLmV4dGVuZChVcGxpbmsucHJvdG90eXBlLCB7XHJcbiAgZ3VpZDogbnVsbCxcclxuICBoYW5kc2hha2U6IG51bGwsXHJcbiAgX2hhbmRzaGFrZTogbnVsbCxcclxuICBpbzogbnVsbCxcclxuICBwaWQ6IG51bGwsXHJcbiAgbGlzdGVuZXJzOiBudWxsLFxyXG4gIHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydDogbnVsbCxcclxuICBzdWJzY3JpcHRpb25zOiBudWxsLFxyXG4gIHN0b3JlOiBudWxsLFxyXG59KTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gVXBsaW5rO1xyXG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=