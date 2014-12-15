const _ = require('lodash-next');
const createEngineIOClient = require('engine.io-client');
const EventEmitter = require('events').EventEmitter;

const DEFAULT_HANDSHAKE_TIMEOUT = 5000;
const DEFAULT_RECONNECT_INTERVAL = 1000;
const DEFAULT_RECONNECT_BACKOFF = 1.5;

/**
 * This class only handles the low-level messages exchanges and handshakes.
 * Subscriptions & listeners bookkeeping is handled by the Uplink class.
 * Connection#events emits 'update', 'emit', and 'handshakeAck' events.
 */
class Connection {
  constructor({ url, guid, handshakeTimeout, reconnectInterval, reconnectBackoff }) {
    _.dev(() => url.should.be.a.String &&
      guid.should.be.a.String
    );
    handshakeTimeout = handshakeTimeout || DEFAULT_HANDSHAKE_TIMEOUT;
    reconnectInterval = reconnectInterval || DEFAULT_RECONNECT_INTERVAL;
    reconnectBackoff = reconnectBackoff || DEFAULT_RECONNECT_BACKOFF;
    _.dev(() => handshakeTimeout.should.be.a.Number.and.not.be.below(0) &&
      reconnectInterval.should.be.a.Number.and.not.be.below(0) &&
      reconnectBackoff.should.be.a.Number.and.not.be.below(1)
    );
    _.extend(this, {
      url,
      guid,
      handshakeTimeout,
      reconnectInterval,
      reconnectBackoff,
      _isDestroyed: false,
      _isConnected: false,
      events: new EventEmitter(),
      subscribedPaths: {},
      listenedRooms: {},
      _io: null,
    });

    this.resetConnectionAttempts();
    this.reconnect();
  }

  destroy() {
    _.dev(() => this.isDestroyed.should.not.be.ok);
    this._isDestroyed = true;
    if(this._io !== null) {
      this._io.close();
    }
    if(this._connectionTimeout !== null) {
      clearTimeout(this._connectionTimeout);
      this._connectionTimeout = null;
    }
    if(this._handshakeTimeout !== null) {
      clearTimeout(this._handshakeTimeout);
      this._handshakeTimeout = null;
    }
    Object.keys(this.subscribedPaths)
    .forEach((path) => { delete this.subscribedPaths[path]; });
    this.subscribedPaths = null;
    Object.keys(this.listenedRooms)
    .forEach((room) => { delete this.listenedRooms[room]; });
    this.listenedRooms = null;
  }

  get isDestroyed() {
    return !!this._isDestroyed;
  }

  get isConnected() {
    return !!this._isConnected;
  }

  resetConnectionAttempts() {
    this._connectionAttempts = 0;
  }

  reconnect() {
    const delay = this._connectionAttempts === 0 ? 0 : this.reconnectInterval * Math.pow(this.reconnectBackoff, (this._connectionAttempts - 1));
    _.dev(() => console.warn('nexus-uplink-client', 'reconnect', { connectionAttempt: this._connectionAttempts, delay }));
    this._connectionAttempts = this._connectionAttempts + 1;
    if(delay === 0) {
      return this.connect();
    }
    else {
      this._connectionTimeout = setTimeout(() => this.connect(), delay);
    }
  }

  connect() {
    _.dev(() => console.warn('nexus-uplink-client', 'connect'));
    _.dev(() => (this._io === null).should.be.ok &&
      this.isConnected.should.not.be.ok &&
      (this._connectionAttempts === 1 || this._connectionTimeout !== null).should.be.ok
    );
    this._connectionTimeout = null;
    this._io = createEngineIOClient(this.url)
    .on('open', () => this.handleIOOpen())
    .on('close', () => this.handleIOClose())
    .on('error', (err) => this.handleIOError(err))
    .on('message', (json) => this.handleIOMessage(json));
  }

  handleIOOpen() {
    _.dev(() => console.warn('nexus-uplink-client', 'open'));
    _.dev(() => this.isConnected.should.not.be.ok);
    this.handshake();
  }

  handleIOClose() {
    _.dev(() => console.warn('nexus-uplink-client', 'close'));
    if(!this.isDestroyed) {
      this._isConnected = false;
      this._io
      .off('open')
      .off('close')
      .off('error')
      .off('message');
      this._io = null;
      this.reconnect();
    }
  }

  handleIOError(err) {
    _.dev(() => console.warn('nexus-uplink-client', 'error', err));
    if(!this.isConnected && !this.isDestroyed) {
      this._io
      .off('open')
      .off('close')
      .off('error')
      .off('message');
      this._io = null;
      this.reconnect();
    }
  }

  handleIOMessage(json) {
    _.dev(() => console.warn('nexus-uplink-client', '<<', json));
    const { event, params } = JSON.parse(json);
    _.dev(() => (event !== void 0).should.be.ok && (params !== void 0).should.be.ok &&
      event.should.be.a.String &&
      (params === null || _.isObject(params)).should.be.ok
    );
    if(event === 'handshakeAck') {
      return this.handleMessageHandshakeAck(params);
    }
    if(event === 'update') {
      return this.handleMessageUpdate(params);
    }
    if(event === 'emit') {
      return this.handleMessageEmit(params);
    }
    if(event === 'debug') {
      return this.handleMessageDebug(params);
    }
    if(event === 'log') {
      return this.handleMessageLog(params);
    }
    if(event === 'warn') {
      return this.handleMessageWarn(params);
    }
    if(event === 'err') {
      return this.handleMessageErr(params);
    }
    throw new Error(`nexus-uplink-client Unrecognized message received ${event} ${JSON.stringify(params, null, 2)}`);
  }

  handleMessageHandshakeAck({ pid }) {
    if(this.isConnected) {
      _.dev(() => console.warn('nexus-uplink-client', 'handshakeAck received while already connected'));
      return;
    }
    clearTimeout(this._handshakeTimeout);
    this._isConnected = true;
    this.events.emit('handshakeAck', { pid });
    Object.keys(this.subscribedPaths)
    .forEach((path) => this.remoteSubscribeTo(path));
    Object.keys(this.listenedRooms)
    .forEach((room) => this.remoteListenTo(room));
    this.resetConnectionAttempts();
  }

  handleMessageUpdate({ path, diff, hash }) {
    _.dev(() => path.should.be.a.String && diff.should.be.an.Object && (hash === null || _.isString(hash)).should.be.ok);
    this.events.emit('update', { path, diff, hash });
  }

  handleMessageEmit({ room, params }) {
    _.dev(() => room.should.be.a.String && (params === null || _.isObject(params)).should.be.ok);
    this.events.emit('emit', { room, params });
  }

  handleMessageDebug(params) {
    _.dev(() => console.warn(params));
  }

  handleMessageLog(params) {
    console.log(params);
  }

  handleMessageWarn(params) {
    console.warn(params);
  }

  handleMessageErr(params) {
    console.error(params);
  }

  handleHandshakeTimeout() {
    _.dev(() => console.warn('nexus-uplink-client', 'handshakeTimeout'));
    // Will implicitly call this.reconnect() in this.handleIOClose().
    this._io.close();
  }

  remoteSend(event, params) {
    _.dev(() => console.warn('nexus-uplink-client', '>>', event, params));
    _.dev(() => (this._io !== null).should.be.ok &&
      event.should.be.a.String &&
      (params === null || _.isObject(params)).should.be.ok
    );
    this._io.send(JSON.stringify({ event, params }));
  }

  remoteHandshake() {
    this.remoteSend('handshake', { guid: this.guid });
  }

  remoteSubscribeTo(path) {
    _.dev(() => path.should.be.a.String);
    this.remoteSend('subscribeTo', { path });
  }

  remoteUnsubscribeFrom(path) {
    _.dev(() => path.should.be.a.String);
    this.remoteSend('unsubscribeFrom', { path });
  }

  remoteListenTo(room) {
    _.dev(() => room.should.be.a.String);
    this.remoteSend('remoteListenTo', { room });
  }

  remoteUnlistenFrom(room) {
    _.dev(() => room.should.be.a.String);
    this.remoteSend('remoteUnlistenFrom', { room });
  }

  handshake() {
    _.dev(() => this.isConnected.should.not.be.ok &&
      (this._handshakeTimeout === null).should.be.ok
    );
    this._handshakeTimeout = setTimeout(() => this.handleHandshakeTimeout(), this.handshakeTimeout);
    this.remoteHandshake();
  }

  subscribeTo(path) {
    _.dev(() => path.should.be.a.String);
    if(this.subscribedPaths[path] === void 0) {
      this.subscribedPaths[path] = 0;
      if(this.isConnected) {
        this.remoteSubscribeTo(path);
      }
    }
    this.subscribedPaths[path] = this.subscribedPaths[path] + 1;
  }

  unsubscribeFrom(path) {
    _.dev(() => path.should.be.a.String);
    _.dev(() => (this.subscribedPaths[path] !== void 0).should.be.ok &&
      this.subscribedPaths[path].should.be.a.Number.and.be.above(0)
    );
    this.subscribedPaths[path] = this.subscribedPaths[path] - 1;
    if(this.subscribedPaths[path] === 0) {
      delete this.subscribedPaths[path];
      if(this.isConnected) {
        this.remoteUnsubscribeFrom(path);
      }
    }
  }

  listenTo(room) {
    _.dev(() => room.should.be.a.String);
    if(this.listenedRooms[room] === void 0) {
      this.listenedRooms[room] = 0;
      if(this.isConnected) {
        this.remoteListenTo(room);
      }
    }
    this.listenedRooms[room] = this.listenedRooms[room] + 1;
  }

  unlistenFrom(room) {
    _.dev(() => room.should.be.a.String);
    _.dev(() => (this.listenedRooms[room] !== void 0).should.be.ok &&
      this.listenedRooms[room].should.be.a.Number.and.be.above(0)
    );
    this.listenedRooms[room] = this.listenedRooms[room] - 1;
    if(this.listenedRooms[room] === 0) {
      delete this.listenedRooms[room];
      if(this.isConnected) {
        this.remoteUnlistenFrom(room);
      }
    }
  }
}

_.extend(Connection.prototype, {
  _destroyed: null,
  _io: null,
  url: null,
  guid: null,
  handshakeTimeout: null,
  reconnectInterval: null,
  reconnectBackoff: null,
  events: null,
  subscribedPaths: null,
  listenedRooms: null,
  _connectionTimeout: null,
  _connectionAttempts: null,
  _handshakeTimeout: null,
  _isConnected: null,
});

module.exports = Connection;
