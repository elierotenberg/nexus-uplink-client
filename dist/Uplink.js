"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");
var Promise = require("bluebird");
var _ = require("lodash-next");

var io = require("socket.io-client");
var request = _.isServer() ? require("request") : require("browser-request");
var resolve = require("url").resolve;
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

  debug: function (params) {
    _.dev(function () {
      return params.should.be.an.Object;
    });
    console.table(params);
  },

  log: function (_ref4) {
    var message = _ref4.message;
    _.dev(function () {
      return message.should.be.a.String;
    });
    console.log(message);
  },

  warn: function (_ref5) {
    var message = _ref5.message;
    _.dev(function () {
      return message.should.be.a.String;
    });
    console.warn(message);
  },

  err: function (_ref6) {
    var message = _ref6.message;
    _.dev(function () {
      return message.should.be.a.String;
    });
    console.error(message);
  } };

var Uplink = (function () {
  var Uplink = function Uplink(_ref7) {
    var _this2 = this;
    var url = _ref7.url;
    var guid = _ref7.guid;
    var shouldReloadOnServerRestart = _ref7.shouldReloadOnServerRestart;
    _.dev(function () {
      return url.should.be.a.String && guid.should.be.a.String;
    });
    this.http = resolve(url, "http");
    this.io = io(resolve(url, "io"));
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
            return ioHandlers[event].call(_this4, params);
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
          return request({ method: "GET", url: resolve(_this6.http, path), json: true }, function (err, res, body) {
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
          return request({ method: "POST", url: resolve(_this7.http, path), json: true, body: _.extend({}, params, { guid: _this7.guid }) }, function (err, res, body) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImQ6L3dvcmtzcGFjZV9wci9tb2NrL25leHVzLXVwbGluay1jbGllbnQvc3JjL1VwbGluay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNsQyxJQUFNLENBQUMsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7O0FBRWpDLElBQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQ3ZDLElBQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFDL0UsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUN2QyxJQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDOztBQUV4QixJQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDdkMsSUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUM7Ozs7OztBQU0vQyxJQUFNLFVBQVUsR0FBRztBQUNqQixTQUFPLEVBQUEsWUFBRztBQUNSLFFBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztHQUNoRDs7QUFFRCxXQUFTLEVBQUEsWUFBRyxFQUdYOztBQUVELFlBQVUsRUFBQSxZQUFHLEVBR1o7O0FBRUQsY0FBWSxFQUFBLGdCQUFVO1FBQVAsR0FBRyxRQUFILEdBQUc7QUFDaEIsUUFBRyxJQUFJLENBQUMsR0FBRyxLQUFLLElBQUksSUFBSSxHQUFHLEtBQUssSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsMkJBQTJCLElB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LENBQzNCLENBQUM7QUFDRixZQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDdkIsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUNoQyxPQUFPLENBQUMsVUFBQyxHQUFHO21CQUFLLE9BQUssU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7V0FBQSxDQUFDLENBQUM7U0FDM0Q7T0FDRjs7OztTQWpLRyxNQUFNOzs7QUFvS1osQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFO0FBQ3pCLE1BQUksRUFBRSxJQUFJO0FBQ1YsV0FBUyxFQUFFLElBQUk7QUFDZixZQUFVLEVBQUUsSUFBSTtBQUNoQixJQUFFLEVBQUUsSUFBSTtBQUNSLEtBQUcsRUFBRSxJQUFJO0FBQ1QsV0FBUyxFQUFFLElBQUk7QUFDZiw2QkFBMkIsRUFBRSxJQUFJO0FBQ2pDLGVBQWEsRUFBRSxJQUFJO0FBQ25CLE9BQUssRUFBRSxJQUFJLEVBQ1osQ0FBQyxDQUFDOztBQUVILE1BQU0sQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDIiwiZmlsZSI6IlVwbGluay5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbmNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuXG5jb25zdCBpbyA9IHJlcXVpcmUoJ3NvY2tldC5pby1jbGllbnQnKTtcbmNvbnN0IHJlcXVlc3QgPSBfLmlzU2VydmVyKCkgPyByZXF1aXJlKCdyZXF1ZXN0JykgOiByZXF1aXJlKCdicm93c2VyLXJlcXVlc3QnKTtcbmNvbnN0IHJlc29sdmUgPSByZXF1aXJlKCd1cmwnKS5yZXNvbHZlO1xuY29uc3Qgc2hvdWxkID0gXy5zaG91bGQ7XG5cbmNvbnN0IExpc3RlbmVyID0gcmVxdWlyZSgnLi9MaXN0ZW5lcicpO1xuY29uc3QgU3Vic2NyaXB0aW9uID0gcmVxdWlyZSgnLi9TdWJzY3JpcHRpb24nKTtcblxuLy8gVGhlc2Ugc29ja2V0LmlvIGhhbmRsZXJzIGFyZSBhY3R1YWxseSBjYWxsZWQgbGlrZSBVcGxpbmsgaW5zdGFuY2UgbWV0aG9kXG4vLyAodXNpbmcgLmNhbGwpLiBJbiB0aGVpciBib2R5ICd0aGlzJyBpcyB0aGVyZWZvcmUgYW4gVXBsaW5rIGluc3RhbmNlLlxuLy8gVGhleSBhcmUgZGVjbGFyZWQgaGVyZSB0byBhdm9pZCBjbHV0dGVyaW5nIHRoZSBVcGxpbmsgY2xhc3MgZGVmaW5pdGlvblxuLy8gYW5kIG1ldGhvZCBuYW1pbmcgY29sbGlzaW9ucy5cbmNvbnN0IGlvSGFuZGxlcnMgPSB7XG4gIGNvbm5lY3QoKSB7XG4gICAgdGhpcy5pby5lbWl0KCdoYW5kc2hha2UnLCB7IGd1aWQ6IHRoaXMuZ3VpZCB9KTtcbiAgfSxcblxuICByZWNvbm5lY3QoKSB7XG4gICAgLy8gVE9ET1xuICAgIC8vIEhhbmRsZSByZWNvbm5lY3Rpb25zIHByb3Blcmx5LlxuICB9LFxuXG4gIGRpc2Nvbm5lY3QoKSB7XG4gICAgLy8gVE9ET1xuICAgIC8vIEhhbmRsZSBkaXNjb25uZWN0aW9ucyBwcm9wZXJseVxuICB9LFxuXG4gIGhhbmRzaGFrZUFjayh7IHBpZCB9KSB7XG4gICAgaWYodGhpcy5waWQgIT09IG51bGwgJiYgcGlkICE9PSB0aGlzLnBpZCAmJiB0aGlzLnNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCAmJiBfLmlzQ2xpZW50KCkpIHtcbiAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICB9XG4gICAgdGhpcy5waWQgPSBwaWQ7XG4gICAgdGhpcy5faGFuZHNoYWtlKHsgcGlkLCBndWlkIH0pO1xuICB9LFxuXG4gIHVwZGF0ZSh7IHBhdGgsIGRpZmYsIGhhc2ggfSkge1xuICAgIC8vIEF0IHRoZSB1cGxpbmsgbGV2ZWwsIHVwZGF0ZXMgYXJlIHRyYW5zbWl0dGVkXG4gICAgLy8gYXMgKGRpZmYsIGhhc2gpLiBJZiB0aGUgdXBsaW5rIGNsaWVudCBoYXNcbiAgICAvLyBhIGNhY2hlZCB2YWx1ZSB3aXRoIHRoZSBtYXRjaGluZyBoYXNoLCB0aGVuXG4gICAgLy8gdGhlIGRpZmYgaXMgYXBwbGllZC4gSWYgbm90LCB0aGVuIHRoZSBmdWxsIHZhbHVlXG4gICAgLy8gaXMgZmV0Y2hlZC5cbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgaWYoIXRoaXMuc3RvcmVbcGF0aF0pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYodGhpcy5zdG9yZVtwYXRoXS5oYXNoID09PSBoYXNoKSB7XG4gICAgICB0aGlzLnN0b3JlW3BhdGhdLnZhbHVlID0gXy5wYXRjaCh0aGlzLnN0b3JlW3BhdGhdLCBkaWZmKTtcbiAgICAgIHRoaXMuc3RvcmVbcGF0aF0uaGFzaCA9IF8uaGFzaCh0aGlzLnN0b3JlW3BhdGhdLnZhbHVlKTtcbiAgICAgIHRoaXMudXBkYXRlKHBhdGgsIHRoaXMuc3RvcmVbcGF0aF0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMucHVsbChwYXRoLCB7IGJ5cGFzc0NhY2hlOiB0cnVlIH0pXG4gICAgICAudGhlbigodmFsdWUpID0+IHRoaXMuc3RvcmVbcGF0aF0gPSB7IHZhbHVlLCBoYXNoOiBfLmhhc2godmFsdWUpIH0pXG4gICAgICAudGhlbigoKSA9PiB0aGlzLnVwZGF0ZShwYXRoLCB0aGlzLnN0b3JlW3BhdGhdKSk7XG4gICAgfVxuICB9LFxuXG4gIGVtaXQoeyByb29tLCBwYXJhbXMgfSkge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0KTtcbiAgICB0aGlzLmVtaXQocm9vbSwgcGFyYW1zKTtcblxuICB9LFxuXG4gIGRlYnVnKHBhcmFtcykge1xuICAgIF8uZGV2KCgpID0+IHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0KTtcbiAgICBjb25zb2xlLnRhYmxlKHBhcmFtcyk7XG4gIH0sXG5cbiAgbG9nKHsgbWVzc2FnZSB9KSB7XG4gICAgXy5kZXYoKCkgPT4gbWVzc2FnZS5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGNvbnNvbGUubG9nKG1lc3NhZ2UpO1xuICB9LFxuXG4gIHdhcm4oeyBtZXNzYWdlIH0pIHtcbiAgICBfLmRldigoKSA9PiBtZXNzYWdlLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgY29uc29sZS53YXJuKG1lc3NhZ2UpO1xuICB9LFxuXG4gIGVycih7IG1lc3NhZ2UgfSkge1xuICAgIF8uZGV2KCgpID0+IG1lc3NhZ2Uuc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBjb25zb2xlLmVycm9yKG1lc3NhZ2UpO1xuICB9LFxufTtcblxuY2xhc3MgVXBsaW5rIHtcbiAgY29uc3RydWN0b3IoeyB1cmwsIGd1aWQsIHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCB9KSB7XG4gICAgXy5kZXYoKCkgPT4gdXJsLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmdcbiAgICApO1xuICAgIHRoaXMuaHR0cCA9IHJlc29sdmUodXJsLCAnaHR0cCcpO1xuICAgIHRoaXMuaW8gPSBpbyhyZXNvbHZlKHVybCwgJ2lvJykpO1xuICAgIHRoaXMucGlkID0gbnVsbDtcbiAgICB0aGlzLmd1aWQgPSBndWlkO1xuICAgIHRoaXMuc2hvdWxkUmVsb2FkT25TZXJ2ZXJSZXN0YXJ0ID0gc2hvdWxkUmVsb2FkT25TZXJ2ZXJSZXN0YXJ0O1xuICAgIHRoaXMuaGFuZHNoYWtlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4gdGhpcy5faGFuZHNoYWtlID0geyByZXNvbHZlLCByZWplY3QgfSkuY2FuY2VsbGFibGUoKTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IHt9O1xuICAgIHRoaXMuc3Vic2NyaXB0aW9ucyA9IHt9O1xuICAgIHRoaXMuc3RvcmUgPSB7fTtcbiAgICB0aGlzLnBlbmRpbmcgPSB7fTtcbiAgICB0aGlzLmJpbmRJT0hhbmRsZXJzKCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIC8vIENhbmNlbCBhbGwgcGVuZGluZyByZXF1ZXN0cy9hY3RpdmUgc3Vic2NyaXB0aW9ucy9saXN0ZW5lcnNcbiAgICBpZighdGhpcy5oYW5kc2hha2UuaXNSZXNvbHZlZCgpKSB7XG4gICAgICB0aGlzLmhhbmRzaGFrZS5jYW5jZWwoKTtcbiAgICB9XG4gICAgT2JqZWN0LmtleXModGhpcy5zdWJzY3JpcHRpb25zKVxuICAgIC5mb3JFYWNoKChwYXRoKSA9PiBPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF0pXG4gICAgICAuZm9yRWFjaCgoaWQpID0+IHRoaXMudW5zdWJzY3JpYmVGcm9tKHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXVtpZF0pKVxuICAgICk7XG4gICAgT2JqZWN0LmtleXModGhpcy5saXN0ZW5lcnMpXG4gICAgLmZvckVhY2goKHJvb20pID0+IE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKVxuICAgICAgLmZvckVhY2goKGlkKSA9PiB0aGlzLnVubGlzdGVuRnJvbSh0aGlzLmxpc3RlbmVyc1tyb29tXVtpZF0pKVxuICAgICk7XG4gICAgT2JqZWN0LmtleXModGhpcy5wZW5kaW5nKVxuICAgIC5mb3JFYWNoKChwYXRoKSA9PiB7XG4gICAgICB0aGlzLnBlbmRpbmdbcGF0aF0uY2FuY2VsKCk7XG4gICAgICBkZWxldGUgdGhpcy5wZW5kaW5nW3BhdGhdO1xuICAgIH0pO1xuICAgIHRoaXMuaW8uY2xvc2UoKTtcbiAgfVxuXG4gIGJpbmRJT0hhbmRsZXJzKCkge1xuICAgIE9iamVjdC5rZXlzKGlvSGFuZGxlcnMpXG4gICAgLmZvckVhY2goKGV2ZW50KSA9PiB0aGlzLmlvLm9uKGV2ZW50LCAocGFyYW1zKSA9PiBpb0hhbmRsZXJzW2V2ZW50XS5jYWxsKHRoaXMsIHBhcmFtcykpKTtcbiAgfVxuXG4gIHB1c2goZXZlbnQsIHBhcmFtcykge1xuICAgIHRoaXMuaW8uZW1pdChldmVudCwgcGFyYW1zKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1bGwocGF0aCwgb3B0cyA9IHt9KSB7XG4gICAgbGV0IHsgYnlwYXNzQ2FjaGUgfSA9IG9wdHM7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGlmKCF0aGlzLnBlbmRpbmdbcGF0aF0gfHwgYnlwYXNzQ2FjaGUpIHtcbiAgICAgIHRoaXMucGVuZGluZ1twYXRoXSA9IHRoaXMuZmV0Y2gocGF0aCkuY2FuY2VsbGFibGUoKS50aGVuKCh2YWx1ZSkgPT4ge1xuICAgICAgICAvLyBBcyBzb29uIGFzIHRoZSByZXN1bHQgaXMgcmVjZWl2ZWQsIHJlbW92ZWQgZnJvbSB0aGUgcGVuZGluZyBsaXN0LlxuICAgICAgICBkZWxldGUgdGhpcy5wZW5kaW5nW3BhdGhdO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9KTtcbiAgICB9XG4gICAgXy5kZXYoKCkgPT4gdGhpcy5wZW5kaW5nW3BhdGhdLnRoZW4uc2hvdWxkLmJlLmEuRnVuY3Rpb24pO1xuICAgIHJldHVybiB0aGlzLnBlbmRpbmdbcGF0aF07XG4gIH1cblxuICBmZXRjaChwYXRoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+XG4gICAgICByZXF1ZXN0KHsgbWV0aG9kOiAnR0VUJywgdXJsOiByZXNvbHZlKHRoaXMuaHR0cCwgcGF0aCksIGpzb246IHRydWUgfSwgKGVyciwgcmVzLCBib2R5KSA9PiBlcnIgPyByZWplY3QoZXJyKSA6IHJlc29sdmUoYm9keSkpXG4gICAgKTtcbiAgfVxuXG4gIGRpc3BhdGNoKGFjdGlvbiwgcGFyYW1zKSB7XG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3RcbiAgICApO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PlxuICAgICAgcmVxdWVzdCh7IG1ldGhvZDogJ1BPU1QnLCB1cmw6IHJlc29sdmUodGhpcy5odHRwLCBwYXRoKSwganNvbjogdHJ1ZSwgYm9keTogXy5leHRlbmQoe30sIHBhcmFtcywgeyBndWlkOiB0aGlzLmd1aWQgfSkgfSwgKGVyciwgcmVzLCBib2R5KSA9PiBlcnIgPyByZWplY3QoZXJyKSA6IHJlc29sdmUoYm9keSkpXG4gICAgKTtcbiAgfVxuXG4gIF9yZW1vdGVTdWJzY3JpYmVUbyhwYXRoKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIHRoaXMuc3RvcmVbcGF0aF0gPSB7IHZhbHVlOiBudWxsLCBoYXNoOiBudWxsIH07XG4gICAgdGhpcy5pby5lbWl0KCdzdWJzY3JpYmVUbycsIHsgcGF0aCB9KTtcbiAgfVxuXG4gIF9yZW1vdGVVbnN1YnNjcmliZUZyb20ocGF0aCkge1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICB0aGlzLmlvLmVtaXQoJ3Vuc3Vic2NyaWJlRnJvbScsIHsgcGF0aCB9KTtcbiAgICBkZWxldGUgdGhpcy5zdG9yZVtwYXRoXTtcbiAgfVxuXG4gIHN1YnNjcmliZVRvKHBhdGgsIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgbGV0IHN1YnNjcmlwdGlvbiA9IG5ldyBTdWJzY3JpcHRpb24oeyBwYXRoLCBoYW5kbGVyIH0pO1xuICAgIGxldCBjcmVhdGVkUGF0aCA9IHN1YnNjcmlwdGlvbi5hZGRUbyh0aGlzLnN1YnNjcmlwdGlvbnMpO1xuICAgIGlmKGNyZWF0ZWRQYXRoKSB7XG4gICAgICB0aGlzLl9yZW1vdGVTdWJzY3JpYmVUbyhwYXRoKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgc3Vic2NyaXB0aW9uLCBjcmVhdGVkUGF0aCB9O1xuICB9XG5cbiAgdW5zdWJzY3JpYmVGcm9tKHN1YnNjcmlwdGlvbikge1xuICAgIF8uZGV2KCgpID0+IHN1YnNjcmlwdGlvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTdWJzY3JpcHRpb24pKTtcbiAgICBsZXQgZGVsZXRlZFBhdGggPSBzdWJzY3JpcHRpb24ucmVtb3ZlRnJvbSh0aGlzLnN1YnNjcmlwdGlvbnMpO1xuICAgIGlmKGRlbGV0ZWRQYXRoKSB7XG4gICAgICB0aGlzLl9yZW1vdGVVbnN1YnNjcmliZUZyb20oc3Vic2NyaXB0aW9uLnBhdGgpO1xuICAgICAgZGVsZXRlIHRoaXMuc3RvcmVbcGF0aF07XG4gICAgfVxuICAgIHJldHVybiB7IHN1YnNjcmlwdGlvbiwgZGVsZXRlZFBhdGggfTtcbiAgfVxuXG4gIHVwZGF0ZShwYXRoLCB2YWx1ZSkge1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAodmFsdWUgPT09IG51bGwgfHwgXy5pc09iamVjdCh2YWx1ZSkpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgaWYodGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdKSB7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF0pXG4gICAgICAuZm9yRWFjaCgoa2V5KSA9PiB0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF1ba2V5XS51cGRhdGUodmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICBfcmVtb3RlTGlzdGVuVG8ocm9vbSkge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICB0aGlzLmlvLmVtaXQoJ2xpc3RlblRvJywgeyByb29tIH0pO1xuICB9XG5cbiAgX3JlbW90ZVVubGlzdGVuRnJvbShyb29tKSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIHRoaXMuaW8uZW1pdCgndW5saXN0ZW5Gcm9tJywgeyByb29tIH0pO1xuICB9XG5cbiAgbGlzdGVuVG8ocm9vbSwgaGFuZGxlcikge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uXG4gICAgKTtcbiAgICBsZXQgbGlzdGVuZXIgPSBuZXcgTGlzdGVuZXIoeyByb29tLCBoYW5kbGVyIH0pO1xuICAgIGxldCBjcmVhdGVkUm9vbSA9IGxpc3RlbmVyLmFkZFRvKHRoaXMubGlzdGVuZXJzKTtcbiAgICBpZihjcmVhdGVkUm9vbSkge1xuICAgICAgdGhpcy5fcmVtb3RlTGlzdGVuVG8ocm9vbSk7XG4gICAgfVxuICAgIHJldHVybiB7IGxpc3RlbmVyLCBjcmVhdGVkUm9vbSB9O1xuICB9XG5cbiAgdW5saXN0ZW5Gcm9tKGxpc3RlbmVyKSB7XG4gICAgXy5kZXYoKCkgPT4gbGlzdGVuZXIuc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoTGlzdGVuZXIpKTtcbiAgICBsZXQgZGVsZXRlZFJvb20gPSBzdWJzY3JpcHRpb24ucmVtb3ZlRnJvbSh0aGlzLmxpc3RlbmVycyk7XG4gICAgaWYoZGVsZXRlZFJvb20pIHtcbiAgICAgIHRoaXMuX3JlbW90ZVVubGlzdGVuRnJvbShsaXN0ZW5lci5yb29tKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgbGlzdGVuZXIsIGRlbGV0ZWRSb29tIH07XG4gIH1cblxuICBlbWl0KHJvb20sIHBhcmFtcykge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdFxuICAgICk7XG4gICAgaWYodGhpcy5saXN0ZW5lcnNbcm9vbV0pIHtcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKVxuICAgICAgLmZvckVhY2goKGtleSkgPT4gdGhpcy5saXN0ZW5lcnNbcm9vbV1ba2V5XS5lbWl0KHBhcmFtcykpO1xuICAgIH1cbiAgfVxufVxuXG5fLmV4dGVuZChVcGxpbmsucHJvdG90eXBlLCB7XG4gIGd1aWQ6IG51bGwsXG4gIGhhbmRzaGFrZTogbnVsbCxcbiAgX2hhbmRzaGFrZTogbnVsbCxcbiAgaW86IG51bGwsXG4gIHBpZDogbnVsbCxcbiAgbGlzdGVuZXJzOiBudWxsLFxuICBzaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQ6IG51bGwsXG4gIHN1YnNjcmlwdGlvbnM6IG51bGwsXG4gIHN0b3JlOiBudWxsLFxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVXBsaW5rO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9