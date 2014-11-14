"use strict";

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1jbGllbnQvc3JjL1VwbGluay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNsQyxJQUFNLENBQUMsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7O0FBRWpDLElBQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQ3ZDLElBQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDeEMsSUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FBRyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUMvRSxJQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDOztBQUV4QixJQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDdkMsSUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUM7Ozs7OztBQU0vQyxJQUFNLFVBQVUsR0FBRztBQUNqQixTQUFPLEVBQUEsWUFBRztBQUNSLFFBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztHQUNoRDs7QUFFRCxXQUFTLEVBQUEsWUFBRyxFQUdYOztBQUVELFlBQVUsRUFBQSxZQUFHLEVBR1o7O0FBRUQsY0FBWSxFQUFBLGdCQUFVO1FBQVAsR0FBRyxRQUFILEdBQUc7QUFDaEIsUUFBRyxJQUFJLENBQUMsR0FBRyxLQUFLLElBQUksSUFBSSxHQUFHLEtBQUssSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsMkJBQTJC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SUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUN2QixnQkFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQ2hDLE9BQU8sQ0FBQyxVQUFDLEdBQUc7bUJBQUssT0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztXQUFBLENBQUMsQ0FBQztTQUMzRDtPQUNGOzs7O1NBaktHLE1BQU07OztBQW9LWixDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7QUFDekIsTUFBSSxFQUFFLElBQUk7QUFDVixXQUFTLEVBQUUsSUFBSTtBQUNmLFlBQVUsRUFBRSxJQUFJO0FBQ2hCLElBQUUsRUFBRSxJQUFJO0FBQ1IsS0FBRyxFQUFFLElBQUk7QUFDVCxXQUFTLEVBQUUsSUFBSTtBQUNmLDZCQUEyQixFQUFFLElBQUk7QUFDakMsZUFBYSxFQUFFLElBQUk7QUFDbkIsT0FBSyxFQUFFLElBQUksRUFDWixDQUFDLENBQUM7O0FBRUgsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMiLCJmaWxlIjoiVXBsaW5rLmpzIiwic291cmNlc0NvbnRlbnQiOlsicmVxdWlyZSgnNnRvNS9wb2x5ZmlsbCcpO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xuY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XG5cbmNvbnN0IGlvID0gcmVxdWlyZSgnc29ja2V0LmlvLWNsaWVudCcpO1xuY29uc3QgcmVsYXRpdmUgPSByZXF1aXJlKCd1cmwnKS5yZXNvbHZlO1xuY29uc3QgcmVxdWVzdCA9IF8uaXNTZXJ2ZXIoKSA/IHJlcXVpcmUoJ3JlcXVlc3QnKSA6IHJlcXVpcmUoJ2Jyb3dzZXItcmVxdWVzdCcpO1xuY29uc3Qgc2hvdWxkID0gXy5zaG91bGQ7XG5cbmNvbnN0IExpc3RlbmVyID0gcmVxdWlyZSgnLi9MaXN0ZW5lcicpO1xuY29uc3QgU3Vic2NyaXB0aW9uID0gcmVxdWlyZSgnLi9TdWJzY3JpcHRpb24nKTtcblxuLy8gVGhlc2Ugc29ja2V0LmlvIGhhbmRsZXJzIGFyZSBhY3R1YWxseSBjYWxsZWQgbGlrZSBVcGxpbmsgaW5zdGFuY2UgbWV0aG9kXG4vLyAodXNpbmcgLmNhbGwpLiBJbiB0aGVpciBib2R5ICd0aGlzJyBpcyB0aGVyZWZvcmUgYW4gVXBsaW5rIGluc3RhbmNlLlxuLy8gVGhleSBhcmUgZGVjbGFyZWQgaGVyZSB0byBhdm9pZCBjbHV0dGVyaW5nIHRoZSBVcGxpbmsgY2xhc3MgZGVmaW5pdGlvblxuLy8gYW5kIG1ldGhvZCBuYW1pbmcgY29sbGlzaW9ucy5cbmNvbnN0IGlvSGFuZGxlcnMgPSB7XG4gIGNvbm5lY3QoKSB7XG4gICAgdGhpcy5pby5lbWl0KCdoYW5kc2hha2UnLCB7IGd1aWQ6IHRoaXMuZ3VpZCB9KTtcbiAgfSxcblxuICByZWNvbm5lY3QoKSB7XG4gICAgLy8gVE9ET1xuICAgIC8vIEhhbmRsZSByZWNvbm5lY3Rpb25zIHByb3Blcmx5LlxuICB9LFxuXG4gIGRpc2Nvbm5lY3QoKSB7XG4gICAgLy8gVE9ET1xuICAgIC8vIEhhbmRsZSBkaXNjb25uZWN0aW9ucyBwcm9wZXJseVxuICB9LFxuXG4gIGhhbmRzaGFrZUFjayh7IHBpZCB9KSB7XG4gICAgaWYodGhpcy5waWQgIT09IG51bGwgJiYgcGlkICE9PSB0aGlzLnBpZCAmJiB0aGlzLnNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCAmJiBfLmlzQ2xpZW50KCkpIHtcbiAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICB9XG4gICAgdGhpcy5waWQgPSBwaWQ7XG4gICAgdGhpcy5faGFuZHNoYWtlKHsgcGlkLCBndWlkIH0pO1xuICB9LFxuXG4gIHVwZGF0ZSh7IHBhdGgsIGRpZmYsIGhhc2ggfSkge1xuICAgIC8vIEF0IHRoZSB1cGxpbmsgbGV2ZWwsIHVwZGF0ZXMgYXJlIHRyYW5zbWl0dGVkXG4gICAgLy8gYXMgKGRpZmYsIGhhc2gpLiBJZiB0aGUgdXBsaW5rIGNsaWVudCBoYXNcbiAgICAvLyBhIGNhY2hlZCB2YWx1ZSB3aXRoIHRoZSBtYXRjaGluZyBoYXNoLCB0aGVuXG4gICAgLy8gdGhlIGRpZmYgaXMgYXBwbGllZC4gSWYgbm90LCB0aGVuIHRoZSBmdWxsIHZhbHVlXG4gICAgLy8gaXMgZmV0Y2hlZC5cbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgaWYoIXRoaXMuc3RvcmVbcGF0aF0pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYodGhpcy5zdG9yZVtwYXRoXS5oYXNoID09PSBoYXNoKSB7XG4gICAgICB0aGlzLnN0b3JlW3BhdGhdLnZhbHVlID0gXy5wYXRjaCh0aGlzLnN0b3JlW3BhdGhdLCBkaWZmKTtcbiAgICAgIHRoaXMuc3RvcmVbcGF0aF0uaGFzaCA9IF8uaGFzaCh0aGlzLnN0b3JlW3BhdGhdLnZhbHVlKTtcbiAgICAgIHRoaXMudXBkYXRlKHBhdGgsIHRoaXMuc3RvcmVbcGF0aF0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMucHVsbChwYXRoLCB7IGJ5cGFzc0NhY2hlOiB0cnVlIH0pXG4gICAgICAudGhlbigodmFsdWUpID0+IHRoaXMuc3RvcmVbcGF0aF0gPSB7IHZhbHVlLCBoYXNoOiBfLmhhc2godmFsdWUpIH0pXG4gICAgICAudGhlbigoKSA9PiB0aGlzLnVwZGF0ZShwYXRoLCB0aGlzLnN0b3JlW3BhdGhdKSk7XG4gICAgfVxuICB9LFxuXG4gIGVtaXQoeyByb29tLCBwYXJhbXMgfSkge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0KTtcbiAgICB0aGlzLmVtaXQocm9vbSwgcGFyYW1zKTtcblxuICB9LFxuXG4gIGRlYnVnKHBhcmFtcykge1xuICAgIF8uZGV2KCgpID0+IHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0KTtcbiAgICBjb25zb2xlLnRhYmxlKHBhcmFtcyk7XG4gIH0sXG5cbiAgbG9nKHsgbWVzc2FnZSB9KSB7XG4gICAgXy5kZXYoKCkgPT4gbWVzc2FnZS5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGNvbnNvbGUubG9nKG1lc3NhZ2UpO1xuICB9LFxuXG4gIHdhcm4oeyBtZXNzYWdlIH0pIHtcbiAgICBfLmRldigoKSA9PiBtZXNzYWdlLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgY29uc29sZS53YXJuKG1lc3NhZ2UpO1xuICB9LFxuXG4gIGVycih7IG1lc3NhZ2UgfSkge1xuICAgIF8uZGV2KCgpID0+IG1lc3NhZ2Uuc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBjb25zb2xlLmVycm9yKG1lc3NhZ2UpO1xuICB9LFxufTtcblxuY2xhc3MgVXBsaW5rIHtcbiAgY29uc3RydWN0b3IoeyB1cmwsIGd1aWQsIHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCB9KSB7XG4gICAgXy5kZXYoKCkgPT4gdXJsLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmdcbiAgICApO1xuICAgIHRoaXMuaHR0cCA9IHVybDtcbiAgICB0aGlzLmlvID0gaW8odXJsKTtcbiAgICB0aGlzLnBpZCA9IG51bGw7XG4gICAgdGhpcy5ndWlkID0gZ3VpZDtcbiAgICB0aGlzLnNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCA9IHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydDtcbiAgICB0aGlzLmhhbmRzaGFrZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHRoaXMuX2hhbmRzaGFrZSA9IHsgcmVzb2x2ZSwgcmVqZWN0IH0pLmNhbmNlbGxhYmxlKCk7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMgPSB7fTtcbiAgICB0aGlzLnN0b3JlID0ge307XG4gICAgdGhpcy5wZW5kaW5nID0ge307XG4gICAgdGhpcy5iaW5kSU9IYW5kbGVycygpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICAvLyBDYW5jZWwgYWxsIHBlbmRpbmcgcmVxdWVzdHMvYWN0aXZlIHN1YnNjcmlwdGlvbnMvbGlzdGVuZXJzXG4gICAgaWYoIXRoaXMuaGFuZHNoYWtlLmlzUmVzb2x2ZWQoKSkge1xuICAgICAgdGhpcy5oYW5kc2hha2UuY2FuY2VsKCk7XG4gICAgfVxuICAgIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaXB0aW9ucylcbiAgICAuZm9yRWFjaCgocGF0aCkgPT4gT2JqZWN0LmtleXModGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdKVxuICAgICAgLmZvckVhY2goKGlkKSA9PiB0aGlzLnVuc3Vic2NyaWJlRnJvbSh0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF1baWRdKSlcbiAgICApO1xuICAgIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzKVxuICAgIC5mb3JFYWNoKChyb29tKSA9PiBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSlcbiAgICAgIC5mb3JFYWNoKChpZCkgPT4gdGhpcy51bmxpc3RlbkZyb20odGhpcy5saXN0ZW5lcnNbcm9vbV1baWRdKSlcbiAgICApO1xuICAgIE9iamVjdC5rZXlzKHRoaXMucGVuZGluZylcbiAgICAuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgdGhpcy5wZW5kaW5nW3BhdGhdLmNhbmNlbCgpO1xuICAgICAgZGVsZXRlIHRoaXMucGVuZGluZ1twYXRoXTtcbiAgICB9KTtcbiAgICB0aGlzLmlvLmNsb3NlKCk7XG4gIH1cblxuICBiaW5kSU9IYW5kbGVycygpIHtcbiAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxuICAgIC5mb3JFYWNoKChldmVudCkgPT4gdGhpcy5pby5vbihldmVudCwgKGpzb25QYXJhbXMpID0+IGlvSGFuZGxlcnNbZXZlbnRdLmNhbGwodGhpcywgSlNPTi5wYXJzZShwYXJhbXMpKSkpO1xuICB9XG5cbiAgcHVzaChldmVudCwgcGFyYW1zKSB7XG4gICAgdGhpcy5pby5lbWl0KGV2ZW50LCBwYXJhbXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHVsbChwYXRoLCBvcHRzID0ge30pIHtcbiAgICBsZXQgeyBieXBhc3NDYWNoZSB9ID0gb3B0cztcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgaWYoIXRoaXMucGVuZGluZ1twYXRoXSB8fCBieXBhc3NDYWNoZSkge1xuICAgICAgdGhpcy5wZW5kaW5nW3BhdGhdID0gdGhpcy5mZXRjaChwYXRoKS5jYW5jZWxsYWJsZSgpLnRoZW4oKHZhbHVlKSA9PiB7XG4gICAgICAgIC8vIEFzIHNvb24gYXMgdGhlIHJlc3VsdCBpcyByZWNlaXZlZCwgcmVtb3ZlZCBmcm9tIHRoZSBwZW5kaW5nIGxpc3QuXG4gICAgICAgIGRlbGV0ZSB0aGlzLnBlbmRpbmdbcGF0aF07XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBfLmRldigoKSA9PiB0aGlzLnBlbmRpbmdbcGF0aF0udGhlbi5zaG91bGQuYmUuYS5GdW5jdGlvbik7XG4gICAgcmV0dXJuIHRoaXMucGVuZGluZ1twYXRoXTtcbiAgfVxuXG4gIGZldGNoKHBhdGgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT5cbiAgICAgIHJlcXVlc3QoeyBtZXRob2Q6ICdHRVQnLCB1cmw6IHJlbGF0aXZlKHRoaXMuaHR0cCwgcGF0aCksIGpzb246IHRydWUgfSwgKGVyciwgcmVzLCBib2R5KSA9PiBlcnIgPyByZWplY3QoZXJyKSA6IHJlc29sdmUoYm9keSkpXG4gICAgKTtcbiAgfVxuXG4gIGRpc3BhdGNoKGFjdGlvbiwgcGFyYW1zKSB7XG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3RcbiAgICApO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PlxuICAgICAgcmVxdWVzdCh7IG1ldGhvZDogJ1BPU1QnLCB1cmw6IHJlbGF0aXZlKHRoaXMuaHR0cCwgcGF0aCksIGpzb246IHRydWUsIGJvZHk6IF8uZXh0ZW5kKHt9LCBwYXJhbXMsIHsgZ3VpZDogdGhpcy5ndWlkIH0pIH0sIChlcnIsIHJlcywgYm9keSkgPT4gZXJyID8gcmVqZWN0KGVycikgOiByZXNvbHZlKGJvZHkpKVxuICAgICk7XG4gIH1cblxuICBfcmVtb3RlU3Vic2NyaWJlVG8ocGF0aCkge1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICB0aGlzLnN0b3JlW3BhdGhdID0geyB2YWx1ZTogbnVsbCwgaGFzaDogbnVsbCB9O1xuICAgIHRoaXMuaW8uZW1pdCgnc3Vic2NyaWJlVG8nLCB7IHBhdGggfSk7XG4gIH1cblxuICBfcmVtb3RlVW5zdWJzY3JpYmVGcm9tKHBhdGgpIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgdGhpcy5pby5lbWl0KCd1bnN1YnNjcmliZUZyb20nLCB7IHBhdGggfSk7XG4gICAgZGVsZXRlIHRoaXMuc3RvcmVbcGF0aF07XG4gIH1cblxuICBzdWJzY3JpYmVUbyhwYXRoLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGhhbmRsZXIuc2hvdWxkLmJlLmEuRnVuY3Rpb25cbiAgICApO1xuICAgIGxldCBzdWJzY3JpcHRpb24gPSBuZXcgU3Vic2NyaXB0aW9uKHsgcGF0aCwgaGFuZGxlciB9KTtcbiAgICBsZXQgY3JlYXRlZFBhdGggPSBzdWJzY3JpcHRpb24uYWRkVG8odGhpcy5zdWJzY3JpcHRpb25zKTtcbiAgICBpZihjcmVhdGVkUGF0aCkge1xuICAgICAgdGhpcy5fcmVtb3RlU3Vic2NyaWJlVG8ocGF0aCk7XG4gICAgfVxuICAgIHJldHVybiB7IHN1YnNjcmlwdGlvbiwgY3JlYXRlZFBhdGggfTtcbiAgfVxuXG4gIHVuc3Vic2NyaWJlRnJvbShzdWJzY3JpcHRpb24pIHtcbiAgICBfLmRldigoKSA9PiBzdWJzY3JpcHRpb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU3Vic2NyaXB0aW9uKSk7XG4gICAgbGV0IGRlbGV0ZWRQYXRoID0gc3Vic2NyaXB0aW9uLnJlbW92ZUZyb20odGhpcy5zdWJzY3JpcHRpb25zKTtcbiAgICBpZihkZWxldGVkUGF0aCkge1xuICAgICAgdGhpcy5fcmVtb3RlVW5zdWJzY3JpYmVGcm9tKHN1YnNjcmlwdGlvbi5wYXRoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN0b3JlW3BhdGhdO1xuICAgIH1cbiAgICByZXR1cm4geyBzdWJzY3JpcHRpb24sIGRlbGV0ZWRQYXRoIH07XG4gIH1cblxuICB1cGRhdGUocGF0aCwgdmFsdWUpIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgKHZhbHVlID09PSBudWxsIHx8IF8uaXNPYmplY3QodmFsdWUpKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGlmKHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXSkge1xuICAgICAgT2JqZWN0LmtleXModGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdKVxuICAgICAgLmZvckVhY2goKGtleSkgPT4gdGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdW2tleV0udXBkYXRlKHZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgX3JlbW90ZUxpc3RlblRvKHJvb20pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgdGhpcy5pby5lbWl0KCdsaXN0ZW5UbycsIHsgcm9vbSB9KTtcbiAgfVxuXG4gIF9yZW1vdGVVbmxpc3RlbkZyb20ocm9vbSkge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICB0aGlzLmlvLmVtaXQoJ3VubGlzdGVuRnJvbScsIHsgcm9vbSB9KTtcbiAgfVxuXG4gIGxpc3RlblRvKHJvb20sIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgbGV0IGxpc3RlbmVyID0gbmV3IExpc3RlbmVyKHsgcm9vbSwgaGFuZGxlciB9KTtcbiAgICBsZXQgY3JlYXRlZFJvb20gPSBsaXN0ZW5lci5hZGRUbyh0aGlzLmxpc3RlbmVycyk7XG4gICAgaWYoY3JlYXRlZFJvb20pIHtcbiAgICAgIHRoaXMuX3JlbW90ZUxpc3RlblRvKHJvb20pO1xuICAgIH1cbiAgICByZXR1cm4geyBsaXN0ZW5lciwgY3JlYXRlZFJvb20gfTtcbiAgfVxuXG4gIHVubGlzdGVuRnJvbShsaXN0ZW5lcikge1xuICAgIF8uZGV2KCgpID0+IGxpc3RlbmVyLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKExpc3RlbmVyKSk7XG4gICAgbGV0IGRlbGV0ZWRSb29tID0gc3Vic2NyaXB0aW9uLnJlbW92ZUZyb20odGhpcy5saXN0ZW5lcnMpO1xuICAgIGlmKGRlbGV0ZWRSb29tKSB7XG4gICAgICB0aGlzLl9yZW1vdGVVbmxpc3RlbkZyb20obGlzdGVuZXIucm9vbSk7XG4gICAgfVxuICAgIHJldHVybiB7IGxpc3RlbmVyLCBkZWxldGVkUm9vbSB9O1xuICB9XG5cbiAgZW1pdChyb29tLCBwYXJhbXMpIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3RcbiAgICApO1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3Jvb21dKSB7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSlcbiAgICAgIC5mb3JFYWNoKChrZXkpID0+IHRoaXMubGlzdGVuZXJzW3Jvb21dW2tleV0uZW1pdChwYXJhbXMpKTtcbiAgICB9XG4gIH1cbn1cblxuXy5leHRlbmQoVXBsaW5rLnByb3RvdHlwZSwge1xuICBndWlkOiBudWxsLFxuICBoYW5kc2hha2U6IG51bGwsXG4gIF9oYW5kc2hha2U6IG51bGwsXG4gIGlvOiBudWxsLFxuICBwaWQ6IG51bGwsXG4gIGxpc3RlbmVyczogbnVsbCxcbiAgc2hvdWxkUmVsb2FkT25TZXJ2ZXJSZXN0YXJ0OiBudWxsLFxuICBzdWJzY3JpcHRpb25zOiBudWxsLFxuICBzdG9yZTogbnVsbCxcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVwbGluaztcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==