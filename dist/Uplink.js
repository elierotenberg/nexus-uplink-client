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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1jbGllbnQvc3JjL1VwbGluay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEMsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDOztBQUVqQyxJQUFNLEVBQUUsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUN2QyxJQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDO0FBQ3hDLElBQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7O0FBRS9FLElBQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN2QyxJQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzs7Ozs7O0FBTS9DLElBQU0sVUFBVSxHQUFHO0FBQ2pCLFNBQU8sRUFBQSxZQUFHO0FBQ1IsUUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7R0FDN0M7O0FBRUQsV0FBUyxFQUFBLFlBQUcsRUFHWDs7QUFFRCxZQUFVLEVBQUEsWUFBRyxFQUdaOztBQUVELGNBQVksRUFBQSxnQkFBVTtRQUFQLEdBQUcsUUFBSCxHQUFHO0FBQ2hCLFFBQUcsSUFBSSxDQUFDLEdBQUcsS0FBSyxJQUFJLElBQUksR0FBRyxLQUFLLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLDJCQUEyQixJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRTtBQUM1RixZQUFNLENBQUMsUUFB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R0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztXQUFBLENBQUMsQ0FBQztTQUMzRDtPQUNGOzs7O1NBcktHLE1BQU07OztBQXdLWixDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7QUFDekIsTUFBSSxFQUFFLElBQUk7QUFDVixXQUFTLEVBQUUsSUFBSTtBQUNmLFlBQVUsRUFBRSxJQUFJO0FBQ2hCLElBQUUsRUFBRSxJQUFJO0FBQ1IsS0FBRyxFQUFFLElBQUk7QUFDVCxXQUFTLEVBQUUsSUFBSTtBQUNmLDZCQUEyQixFQUFFLElBQUk7QUFDakMsZUFBYSxFQUFFLElBQUk7QUFDbkIsT0FBSyxFQUFFLElBQUksRUFDWixDQUFDLENBQUM7O0FBRUgsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMiLCJmaWxlIjoiVXBsaW5rLmpzIiwic291cmNlc0NvbnRlbnQiOlsicmVxdWlyZSgnNnRvNS9wb2x5ZmlsbCcpO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xuY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XG5cbmNvbnN0IGlvID0gcmVxdWlyZSgnc29ja2V0LmlvLWNsaWVudCcpO1xuY29uc3QgcmVsYXRpdmUgPSByZXF1aXJlKCd1cmwnKS5yZXNvbHZlO1xuY29uc3QgcmVxdWVzdCA9IF8uaXNTZXJ2ZXIoKSA/IHJlcXVpcmUoJ3JlcXVlc3QnKSA6IHJlcXVpcmUoJ2Jyb3dzZXItcmVxdWVzdCcpO1xuXG5jb25zdCBMaXN0ZW5lciA9IHJlcXVpcmUoJy4vTGlzdGVuZXInKTtcbmNvbnN0IFN1YnNjcmlwdGlvbiA9IHJlcXVpcmUoJy4vU3Vic2NyaXB0aW9uJyk7XG5cbi8vIFRoZXNlIHNvY2tldC5pbyBoYW5kbGVycyBhcmUgYWN0dWFsbHkgY2FsbGVkIGxpa2UgVXBsaW5rIGluc3RhbmNlIG1ldGhvZFxuLy8gKHVzaW5nIC5jYWxsKS4gSW4gdGhlaXIgYm9keSAndGhpcycgaXMgdGhlcmVmb3JlIGFuIFVwbGluayBpbnN0YW5jZS5cbi8vIFRoZXkgYXJlIGRlY2xhcmVkIGhlcmUgdG8gYXZvaWQgY2x1dHRlcmluZyB0aGUgVXBsaW5rIGNsYXNzIGRlZmluaXRpb25cbi8vIGFuZCBtZXRob2QgbmFtaW5nIGNvbGxpc2lvbnMuXG5jb25zdCBpb0hhbmRsZXJzID0ge1xuICBjb25uZWN0KCkge1xuICAgIHRoaXMucHVzaCgnaGFuZHNoYWtlJywgeyBndWlkOiB0aGlzLmd1aWQgfSk7XG4gIH0sXG5cbiAgcmVjb25uZWN0KCkge1xuICAgIC8vIFRPRE9cbiAgICAvLyBIYW5kbGUgcmVjb25uZWN0aW9ucyBwcm9wZXJseS5cbiAgfSxcblxuICBkaXNjb25uZWN0KCkge1xuICAgIC8vIFRPRE9cbiAgICAvLyBIYW5kbGUgZGlzY29ubmVjdGlvbnMgcHJvcGVybHlcbiAgfSxcblxuICBoYW5kc2hha2VBY2soeyBwaWQgfSkge1xuICAgIGlmKHRoaXMucGlkICE9PSBudWxsICYmIHBpZCAhPT0gdGhpcy5waWQgJiYgdGhpcy5zaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQgJiYgXy5pc0NsaWVudCgpKSB7XG4gICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgfVxuICAgIHRoaXMucGlkID0gcGlkO1xuICAgIHRoaXMuX2hhbmRzaGFrZSh7IHBpZCB9KTtcbiAgfSxcblxuICB1cGRhdGUoeyBwYXRoLCBkaWZmLCBoYXNoIH0pIHtcbiAgICAvLyBBdCB0aGUgdXBsaW5rIGxldmVsLCB1cGRhdGVzIGFyZSB0cmFuc21pdHRlZFxuICAgIC8vIGFzIChkaWZmLCBoYXNoKS4gSWYgdGhlIHVwbGluayBjbGllbnQgaGFzXG4gICAgLy8gYSBjYWNoZWQgdmFsdWUgd2l0aCB0aGUgbWF0Y2hpbmcgaGFzaCwgdGhlblxuICAgIC8vIHRoZSBkaWZmIGlzIGFwcGxpZWQuIElmIG5vdCwgdGhlbiB0aGUgZnVsbCB2YWx1ZVxuICAgIC8vIGlzIGZldGNoZWQuXG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGlmKCF0aGlzLnN0b3JlW3BhdGhdKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmKHRoaXMuc3RvcmVbcGF0aF0uaGFzaCA9PT0gaGFzaCkge1xuICAgICAgdGhpcy5zdG9yZVtwYXRoXS52YWx1ZSA9IF8ucGF0Y2godGhpcy5zdG9yZVtwYXRoXSwgZGlmZik7XG4gICAgICB0aGlzLnN0b3JlW3BhdGhdLmhhc2ggPSBfLmhhc2godGhpcy5zdG9yZVtwYXRoXS52YWx1ZSk7XG4gICAgICB0aGlzLnVwZGF0ZShwYXRoLCB0aGlzLnN0b3JlW3BhdGhdKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLnB1bGwocGF0aCwgeyBieXBhc3NDYWNoZTogdHJ1ZSB9KVxuICAgICAgLnRoZW4oKHZhbHVlKSA9PiB0aGlzLnN0b3JlW3BhdGhdID0geyB2YWx1ZSwgaGFzaDogXy5oYXNoKHZhbHVlKSB9KVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy51cGRhdGUocGF0aCwgdGhpcy5zdG9yZVtwYXRoXSkpO1xuICAgIH1cbiAgfSxcblxuICBlbWl0KHsgcm9vbSwgcGFyYW1zIH0pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJiBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdCk7XG4gICAgdGhpcy5lbWl0KHJvb20sIHBhcmFtcyk7XG4gIH0sXG5cbiAgZGVidWcoLi4uYXJncykge1xuICAgIGNvbnNvbGUudGFibGUoLi4uYXJncyk7XG4gIH0sXG5cbiAgbG9nKC4uLmFyZ3MpIHtcbiAgICBjb25zb2xlLmxvZyguLi5hcmdzKTtcbiAgfSxcblxuICB3YXJuKC4uLmFyZ3MpIHtcbiAgICBjb25zb2xlLndhcm4oLi4uYXJncyk7XG4gIH0sXG5cbiAgZXJyKC4uLmFyZ3MpIHtcbiAgICBjb25zb2xlLmVycm9yKC4uLmFyZ3MpO1xuICB9LFxufTtcblxuY2xhc3MgVXBsaW5rIHtcbiAgY29uc3RydWN0b3IoeyB1cmwsIGd1aWQsIHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCB9KSB7XG4gICAgXy5kZXYoKCkgPT4gdXJsLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmdcbiAgICApO1xuICAgIHRoaXMuaHR0cCA9IHVybDtcbiAgICB0aGlzLmlvID0gaW8odXJsKTtcbiAgICB0aGlzLnBpZCA9IG51bGw7XG4gICAgdGhpcy5ndWlkID0gZ3VpZDtcbiAgICB0aGlzLnNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydCA9IHNob3VsZFJlbG9hZE9uU2VydmVyUmVzdGFydDtcbiAgICB0aGlzLmhhbmRzaGFrZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHRoaXMuX2hhbmRzaGFrZSA9IHsgcmVzb2x2ZSwgcmVqZWN0IH0pLmNhbmNlbGxhYmxlKCk7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMgPSB7fTtcbiAgICB0aGlzLnN0b3JlID0ge307XG4gICAgdGhpcy5wZW5kaW5nID0ge307XG4gICAgdGhpcy5iaW5kSU9IYW5kbGVycygpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICAvLyBDYW5jZWwgYWxsIHBlbmRpbmcgcmVxdWVzdHMvYWN0aXZlIHN1YnNjcmlwdGlvbnMvbGlzdGVuZXJzXG4gICAgaWYoIXRoaXMuaGFuZHNoYWtlLmlzUmVzb2x2ZWQoKSkge1xuICAgICAgdGhpcy5oYW5kc2hha2UuY2FuY2VsKCk7XG4gICAgfVxuICAgIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaXB0aW9ucylcbiAgICAuZm9yRWFjaCgocGF0aCkgPT4gT2JqZWN0LmtleXModGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdKVxuICAgICAgLmZvckVhY2goKGlkKSA9PiB0aGlzLnVuc3Vic2NyaWJlRnJvbSh0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF1baWRdKSlcbiAgICApO1xuICAgIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzKVxuICAgIC5mb3JFYWNoKChyb29tKSA9PiBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSlcbiAgICAgIC5mb3JFYWNoKChpZCkgPT4gdGhpcy51bmxpc3RlbkZyb20odGhpcy5saXN0ZW5lcnNbcm9vbV1baWRdKSlcbiAgICApO1xuICAgIE9iamVjdC5rZXlzKHRoaXMucGVuZGluZylcbiAgICAuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgdGhpcy5wZW5kaW5nW3BhdGhdLmNhbmNlbCgpO1xuICAgICAgZGVsZXRlIHRoaXMucGVuZGluZ1twYXRoXTtcbiAgICB9KTtcbiAgICB0aGlzLmlvLmNsb3NlKCk7XG4gIH1cblxuICBiaW5kSU9IYW5kbGVycygpIHtcbiAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxuICAgIC5mb3JFYWNoKChldmVudCkgPT4gdGhpcy5pby5vbihldmVudCwgKHBhcmFtcykgPT4ge1xuICAgICAgXy5kZXYoKCkgPT4gY29uc29sZS53YXJuKCduZXh1cy11cGxpbmstY2xpZW50JywgJzw8JywgZXZlbnQsIHBhcmFtcykpO1xuICAgICAgcmV0dXJuIGlvSGFuZGxlcnNbZXZlbnRdLmNhbGwodGhpcywgXy5wcm9sbHlwYXJzZShwYXJhbXMpKTtcbiAgICB9KSk7XG4gIH1cblxuICBwdXNoKGV2ZW50LCBwYXJhbXMpIHtcbiAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oJ25leHVzLXVwbGluay1jbGllbnQnLCAnPj4nLCBldmVudCwgcGFyYW1zKSk7XG4gICAgdGhpcy5pby5lbWl0KGV2ZW50LCBwYXJhbXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHVsbChwYXRoLCBvcHRzID0ge30pIHtcbiAgICBsZXQgeyBieXBhc3NDYWNoZSB9ID0gb3B0cztcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgaWYoIXRoaXMucGVuZGluZ1twYXRoXSB8fCBieXBhc3NDYWNoZSkge1xuICAgICAgdGhpcy5wZW5kaW5nW3BhdGhdID0gdGhpcy5mZXRjaChwYXRoKS5jYW5jZWxsYWJsZSgpLnRoZW4oKHZhbHVlKSA9PiB7XG4gICAgICAgIC8vIEFzIHNvb24gYXMgdGhlIHJlc3VsdCBpcyByZWNlaXZlZCwgcmVtb3ZlZCBmcm9tIHRoZSBwZW5kaW5nIGxpc3QuXG4gICAgICAgIGRlbGV0ZSB0aGlzLnBlbmRpbmdbcGF0aF07XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBfLmRldigoKSA9PiB0aGlzLnBlbmRpbmdbcGF0aF0udGhlbi5zaG91bGQuYmUuYS5GdW5jdGlvbik7XG4gICAgcmV0dXJuIHRoaXMucGVuZGluZ1twYXRoXTtcbiAgfVxuXG4gIGZldGNoKHBhdGgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT5cbiAgICAgIHJlcXVlc3QoeyBtZXRob2Q6ICdHRVQnLCB1cmw6IHJlbGF0aXZlKHRoaXMuaHR0cCwgcGF0aCksIGpzb246IHRydWUgfSwgKGVyciwgcmVzLCBib2R5KSA9PiBlcnIgPyByZWplY3QoZXJyKSA6IHJlc29sdmUoYm9keSkpXG4gICAgKTtcbiAgfVxuXG4gIGRpc3BhdGNoKGFjdGlvbiwgcGFyYW1zKSB7XG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3RcbiAgICApO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PlxuICAgICAgcmVxdWVzdCh7IG1ldGhvZDogJ1BPU1QnLCB1cmw6IHJlbGF0aXZlKHRoaXMuaHR0cCwgYWN0aW9uKSwganNvbjogdHJ1ZSwgYm9keTogXy5leHRlbmQoe30sIHBhcmFtcywgeyBndWlkOiB0aGlzLmd1aWQgfSkgfSwgKGVyciwgcmVzLCBib2R5KSA9PiBlcnIgPyByZWplY3QoZXJyKSA6IHJlc29sdmUoYm9keSkpXG4gICAgKTtcbiAgfVxuXG4gIF9yZW1vdGVTdWJzY3JpYmVUbyhwYXRoKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIHRoaXMuc3RvcmVbcGF0aF0gPSB7IHZhbHVlOiBudWxsLCBoYXNoOiBudWxsIH07XG4gICAgdGhpcy5pby5lbWl0KCdzdWJzY3JpYmVUbycsIHsgcGF0aCB9KTtcbiAgfVxuXG4gIF9yZW1vdGVVbnN1YnNjcmliZUZyb20ocGF0aCkge1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICB0aGlzLmlvLmVtaXQoJ3Vuc3Vic2NyaWJlRnJvbScsIHsgcGF0aCB9KTtcbiAgICBkZWxldGUgdGhpcy5zdG9yZVtwYXRoXTtcbiAgfVxuXG4gIHN1YnNjcmliZVRvKHBhdGgsIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgbGV0IHN1YnNjcmlwdGlvbiA9IG5ldyBTdWJzY3JpcHRpb24oeyBwYXRoLCBoYW5kbGVyIH0pO1xuICAgIGxldCBjcmVhdGVkUGF0aCA9IHN1YnNjcmlwdGlvbi5hZGRUbyh0aGlzLnN1YnNjcmlwdGlvbnMpO1xuICAgIGlmKGNyZWF0ZWRQYXRoKSB7XG4gICAgICB0aGlzLl9yZW1vdGVTdWJzY3JpYmVUbyhwYXRoKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgc3Vic2NyaXB0aW9uLCBjcmVhdGVkUGF0aCB9O1xuICB9XG5cbiAgdW5zdWJzY3JpYmVGcm9tKHN1YnNjcmlwdGlvbikge1xuICAgIF8uZGV2KCgpID0+IHN1YnNjcmlwdGlvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTdWJzY3JpcHRpb24pKTtcbiAgICBsZXQgZGVsZXRlZFBhdGggPSBzdWJzY3JpcHRpb24ucmVtb3ZlRnJvbSh0aGlzLnN1YnNjcmlwdGlvbnMpO1xuICAgIGlmKGRlbGV0ZWRQYXRoKSB7XG4gICAgICB0aGlzLl9yZW1vdGVVbnN1YnNjcmliZUZyb20oc3Vic2NyaXB0aW9uLnBhdGgpO1xuICAgICAgZGVsZXRlIHRoaXMuc3RvcmVbc3Vic2NyaXB0aW9uLnBhdGhdO1xuICAgIH1cbiAgICByZXR1cm4geyBzdWJzY3JpcHRpb24sIGRlbGV0ZWRQYXRoIH07XG4gIH1cblxuICB1cGRhdGUocGF0aCwgdmFsdWUpIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgKHZhbHVlID09PSBudWxsIHx8IF8uaXNPYmplY3QodmFsdWUpKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGlmKHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXSkge1xuICAgICAgT2JqZWN0LmtleXModGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdKVxuICAgICAgLmZvckVhY2goKGtleSkgPT4gdGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdW2tleV0udXBkYXRlKHZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgX3JlbW90ZUxpc3RlblRvKHJvb20pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgdGhpcy5pby5lbWl0KCdsaXN0ZW5UbycsIHsgcm9vbSB9KTtcbiAgfVxuXG4gIF9yZW1vdGVVbmxpc3RlbkZyb20ocm9vbSkge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICB0aGlzLmlvLmVtaXQoJ3VubGlzdGVuRnJvbScsIHsgcm9vbSB9KTtcbiAgfVxuXG4gIGxpc3RlblRvKHJvb20sIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgbGV0IGxpc3RlbmVyID0gbmV3IExpc3RlbmVyKHsgcm9vbSwgaGFuZGxlciB9KTtcbiAgICBsZXQgY3JlYXRlZFJvb20gPSBsaXN0ZW5lci5hZGRUbyh0aGlzLmxpc3RlbmVycyk7XG4gICAgaWYoY3JlYXRlZFJvb20pIHtcbiAgICAgIHRoaXMuX3JlbW90ZUxpc3RlblRvKHJvb20pO1xuICAgIH1cbiAgICByZXR1cm4geyBsaXN0ZW5lciwgY3JlYXRlZFJvb20gfTtcbiAgfVxuXG4gIHVubGlzdGVuRnJvbShsaXN0ZW5lcikge1xuICAgIF8uZGV2KCgpID0+IGxpc3RlbmVyLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKExpc3RlbmVyKSk7XG4gICAgbGV0IGRlbGV0ZWRSb29tID0gbGlzdGVuZXIucmVtb3ZlRnJvbSh0aGlzLmxpc3RlbmVycyk7XG4gICAgaWYoZGVsZXRlZFJvb20pIHtcbiAgICAgIHRoaXMuX3JlbW90ZVVubGlzdGVuRnJvbShsaXN0ZW5lci5yb29tKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgbGlzdGVuZXIsIGRlbGV0ZWRSb29tIH07XG4gIH1cblxuICBlbWl0KHJvb20sIHBhcmFtcykge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdFxuICAgICk7XG4gICAgaWYodGhpcy5saXN0ZW5lcnNbcm9vbV0pIHtcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKVxuICAgICAgLmZvckVhY2goKGtleSkgPT4gdGhpcy5saXN0ZW5lcnNbcm9vbV1ba2V5XS5lbWl0KHBhcmFtcykpO1xuICAgIH1cbiAgfVxufVxuXG5fLmV4dGVuZChVcGxpbmsucHJvdG90eXBlLCB7XG4gIGd1aWQ6IG51bGwsXG4gIGhhbmRzaGFrZTogbnVsbCxcbiAgX2hhbmRzaGFrZTogbnVsbCxcbiAgaW86IG51bGwsXG4gIHBpZDogbnVsbCxcbiAgbGlzdGVuZXJzOiBudWxsLFxuICBzaG91bGRSZWxvYWRPblNlcnZlclJlc3RhcnQ6IG51bGwsXG4gIHN1YnNjcmlwdGlvbnM6IG51bGwsXG4gIHN0b3JlOiBudWxsLFxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVXBsaW5rO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9