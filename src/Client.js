const EngineIOClient = require('engine.io-client');
const { Requester } = require('immutable-request');
const _ = require('lodash-next');

module.exports = function(Engine) {

  const CLIENT_STATUS = {
    NOT_STARTED: 1,
    BACKING_OFF: 2,
    CONNECTING: 3,
    CONNECTED: 3,
  };

  const DEFAULT_URL = 'http://localhost:8888';
  const DEFAULT_CACHE_SIZE = 1000;
  const DEFAULT_CACHE_AGE = 3600000;
  const DEFAULT_REQUEST_TIMEOUT = 10000;

  class Client {
    constructor(engine, options) {
      options = options || {};
      _.dev(() => {
        engine.should.be.an.instanceOf(Engine);
        options.should.be.an.Object;
      });
      _.extend(this, {
        _engine: engine,
        _reconnect: options.reconnect === void 0 ? true : options.reconnect,
        _initial: options.initial || 1000,
        _backOff: options.backoff || 1.5,
        _ceil: options.ceil || 30000,
        _socket: null,
        _status: CLIENT_STATUS.STARTED,
        _failedAttempts: null,
        _reconnectTimeout: null,
        _url: options.url || DEFAULT_URL,
      });
      this.engine.requester = new Requester(this._url, {
        max: options.cacheSize || DEFAULT_CACHE_SIZE,
        maxAge: options.cacheAge || DEFAULT_CACHE_AGE,
        timeout: options.requestTimeout || DEFAULT_REQUEST_TIMEOUT,
      });
    }

    start() {
      _.dev(() => {
        this._status.should.be.exactly(CLIENT_STATUS.NOT_STARTED);
        (this._failedAttempts === null).should.be.ok;
      });
      this._failedAttempts = 0;
      this._status = CLIENT_STATUS.BACKING_OFF;
      // Not a typo, we actually want to use setTimeout(0), not setImmediate,
      // because we want it to be symmetrical with _handleConnectionFailure.
      this._reconnectTimeout = setTimeout(() => this._connect(), 0);
    }

    _connect() {
      _.dev(() => {
        this._url.should.be.a.String;
        (this._reconnectTimeout !== null).should.be.ok;
        this._status.should.be.exactly(CLIENT_STATUS.BACKING_OFF);
        (this._socket === null).should.be.ok;
      });
      this._reconnectTimeout = null;
      this._status = CLIENT_STATUS.CONNECTING;
      const socket = EngineIOClient(this._url);
      socket.on('open', () => this._handleConnectionSuccess());
      socket.on('close', () => {
        if(this._status === CLIENT_STATUS.CONNECTING) {
          this._handleConnectionFailure();
        }
        else {
          this._handleDisconnection();
        }
      });
      socket.on('message', (message) => this._handleMessage(message));
      socket.on('error', (err) => this._handleError(err));
      this._socket = socket;
    }

    _handleConnectionFailure() {
      _.dev(() => {
        (this._socket !== null).should.be.ok;
        this._status.should.be.exactly(CLIENT_STATUS.CONNECTING);
        this._failedAttempts.should.be.a.Number;
        (this._reconnectTimeout === null).should.be.ok;
      });
      this._socket = null;
      this._status = CLIENT_STATUS.BACKING_OFF;
      this._failedAttempts = this._failedAttempts + 1;
      const backOffFor = Math.min(this._initial * Math.pow(this._backOff, (this._failedAttempts - 1)), this._ceil);
      this._reconnectTimeout = setTimeout(() => this._connect(), backOffFor);
    }

    _handleConnectionSuccess() {
      _.dev(() => {
        this._status.should.be.exactly(CLIENT_STATUS.CONNECTING);
        this._failedAttempts.should.be.a.Number;
      });
      // Reset failed attempts counter
      this._failedAttempts = null;
      this._engine.handleConnection(this._socket);
    }

    _handleDisconnection() {
      _.dev(() => {
        this._status.should.be.exactly(CLIENT_STATUS.CONNECTED);
        (this._failedAttempts === null).should.be.ok;
      });
      this._engine.handleDisconnection();
      this._status = CLIENT_STATUS.BACKING_OFF;
      this._failedAttempts = 0;
      this._connect();
    }

    _handleMessage(message) {
      _.dev(() => {
        this._status.should.be.exactly(CLIENT_STATUS.CONNECTED);
        message.should.be.a.String;
      });
      this._engine.handleMessage(message);
    }

    _handleError(err) {
      _.dev(() => console.warn(`Socket $error:`, err));
    }
  }

  _.extend(Client, {
    _engine: null,
    _reconnect: null,
    _initial: null,
    _backoff: null,
    _ceil: null,
    _socket: null,
    _status: null,
    _failedAttempts: null,
    _reconnectTimeout: null,
    _url: null,
  });

  return Client;

};
