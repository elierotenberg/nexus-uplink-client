const _ = require('lodash-next');
const { parse, format, resolve } = require('url');

const Requester = require('./Requester');
const Connection = require('./Connection');
const Listener = require('./Listener');
const Subscription = require('./Subscription');

const NO_VERSION = -1;

class Uplink {
  constructor({ url, guid, requestTimeout, handshakeTimeout, reconnectInterval, reconnectBackoff, shouldReloadOnServerRestart }) {
    const _shouldReloadOnServerRestart = (shouldReloadOnServerRestart === void 0) ? true : !!shouldReloadOnServerRestart;
    guid = (guid === void 0) ? _.guid() : guid;
    _.dev(() => url.should.be.a.String &&
      guid.should.be.a.String &&
      _shouldReloadOnServerRestart.should.be.a.Boolean
    );
    _.extend(this, {
      url,
      guid,
      _shouldReloadOnServerRestart,
      _listeners: {},
      _subscriptions: {},
      _storeCache: {},
      _connection: new Connection({ url, guid, handshakeTimeout, reconnectInterval, reconnectBackoff }),
      _requester: new Requester({ requestTimeout }),
    });
    this._connection.events.on('update', ({ path, diff, prevVersion, nextVersion }) => this._handleUpdate({ path, diff, prevVersion, nextVersion }));
    this._connection.events.on('emit', ({ room, params }) => this._handleEmit({ room, params }));
    this._connection.events.on('handshakeAck', ({ pid }) => this._handleHanshakeAck({ pid }));
  }

  // Public methods

  destroy() {
    // Cancel all pending requests/active subscriptions/listeners
    Object.keys(this._subscriptions)
    .forEach((path) => Object.keys(this._subscriptions[path])
      .forEach((id) => this.unsubscribeFrom(this._subscriptions[path][id]))
    );
    this._subscriptions = null;
    Object.keys(this._listeners)
    .forEach((room) => Object.keys(this._listeners[room])
      .forEach((id) => this.unlistenFrom(this._listeners[room][id]))
    );
    this._listeners = null;
    Object.keys(this._storeCache)
    .forEach((path) => delete this._storeCache[path]);
    this._storeCache = null;
    this._connection.destroy();
    this._requester.destroy();
  }

  pull(path) {
    _.dev(() => path.should.be.a.String);
    if(this._storeCache[path]) {
      return Promise.resolve(this._storeCache[path].value);
    }
    else {
      return this._refresh(path, NO_VERSION);
    }
  }

  dispatch(action, params) {
    _.dev(() => action.should.be.a.String &&
      params.should.be.an.Object
    );
    return this._requester.post(resolve(this.url, action), _.extend({}, params, { guid: this.guid }));
  }

  subscribeTo(path, handler) {
    _.dev(() => path.should.be.a.String &&
      handler.should.be.a.Function
    );
    const subscription = new Subscription({ path, handler });
    const createdPath = subscription.addTo(this._subscriptions);
    if(createdPath) {
      this._connection.subscribeTo(path);
    }
    // Immediatly attempt to pull to sync the cache
    this.pull(path)
    .then((value) => subscription.update(value, this._storeCache[path].version));
    return { subscription, createdPath };
  }

  unsubscribeFrom(subscription) {
    _.dev(() => subscription.should.be.an.instanceOf(Subscription));
    const path = { subscription };
    const deletedPath = subscription.removeFrom(this._subscriptions);
    this._connection.unsubscribeFrom(path);
    if(deletedPath) {
      this._connection.abort(resolve(this.url, path));
      delete this._storeCache[path];
      this._connection.unsubscribeFrom(path);
    }
    return { subscription, deletedPath };
  }

  listenTo(room, handler) {
    _.dev(() => room.should.be.a.String &&
      handler.should.be.a.Function
    );
    const listener = new Listener({ room, handler });
    const createdRoom = listener.addTo(this._listeners);
    if(createdRoom) {
      this._connection.listenTo(room);
    }
    return { listener, createdRoom };
  }

  unlistenFrom(listener) {
    _.dev(() => listener.should.be.an.instanceOf(Listener));
    const { room } = listener;
    const deletedRoom = listener.removeFrom(this._listeners);
    if(deletedRoom) {
      this._connection.unlistenFrom(room);
    }
    return { listener, deletedRoom };
  }

  // Private methods

  _handleUpdate({ path, diff, prevVersion, nextVersion }) {
    _.dev(() => path.should.be.a.String &&
      diff.should.be.an.Object &&
      prevVersion.should.be.a.Number &&
      nextVersion.should.be.a.Number
    );
    if(this._subscriptions[path] === void 0) {
      _.dev(() => console.warn('nexus-uplink-client', `update for path ${path} without matching subscription`));
      return;
    }
    if(this._storeCache[path] !== void 0 && this._storeCache[path].version === prevVersion) {
      return this._set(path, _.patch(this._storeCache[path].value, diff), nextVersion);
    }
    return this._refresh(path, nextVersion);
  }

  _handleEmit({ room, params }) {
    if(this.listeners[room] === void 0) {
      _.dev(() => console.warn('nexus-uplink-client', `emit for room ${room} without matching listener`));
      return;
    }
    return this._propagateEmit(room, params);
  }

  _handleHanshakeAck({ pid }) {
    _.dev(() => pid.should.be.a.String);
    if(this.pid === null) {
      this.pid = pid;
    }
    else if(this.pid !== pid) {
      _.dev(() => console.warn('nexus-uplink-client', 'handshakeAck with new pid', pid, this.pid));
      if(this._shouldReloadOnServerRestart && __BROWSER__) {
        window.location.reload(true);
      }
    }
  }

  _refresh(path, version) {
    _.dev(() => path.should.be.a.String && version.should.be.a.Number);
    const url = parse(resolve(this.url, path), true);
    url.query = url.query || {};
    if(version !== NO_VERSION) {
      url.query.v = version;
    }
    return this._requester.get(format(url))
    .then((value) => this._set(path, value, version));
  }

  _set(path, value, version) {
    _.dev(() => path.should.be.a.String &&
      (value === null || _.isObject(value)).should.be.ok &&
      version.should.be.a.Number
    );
    // Only update if there was no previous version or an older version
    if(this._storeCache[path] === void 0 || this._storeCache[path].version < version) {
      this._storeCache[path] = { value, version };
      this._propagateUpdate(path, value, version);
    }
    return this._storeCache[path].value;
  }

  _propagateUpdate(path, value, version) {
    _.dev(() => path.should.be.a.String &&
      (value === null || _.isObject(value)).should.be.ok
    );
    if(this._subscriptions[path] !== void 0) {
      Object.keys(this._subscriptions[path])
      .forEach((k) => this._subscriptions[path][k].update(value, version));
    }
  }

  _propagateEmit(room, params) {
    _.dev(() => room.should.be.a.String &&
      (params === null) || _.isObject(params).should.be.ok
    );
    if(this._listeners[room]) {
      Object.keys(this._listeners[room])
      .forEach((k) => this._listeners[room][k].emit(params));
    }
  }
}

_.extend(Uplink.prototype, {
  url: null,
  guid: null,
  pid: null,
  _subscriptions: null,
  _storeCache: null,
  _listeners: null,
  _connection: null,
  _requester: null,
});

module.exports = Uplink;
