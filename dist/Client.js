"use strict";

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = process.env.NODE_ENV !== "production";var __PROD__ = !__DEV__;var __BROWSER__ = typeof window === "object";var __NODE__ = !__BROWSER__;var EngineIOClient = require("engine.io-client");
var _ref = require("immutable-request");

var Requester = _ref.Requester;
var _ = require("lodash-next");

module.exports = function (Engine) {
  var CLIENT_STATUS = {
    NOT_STARTED: 1,
    BACKING_OFF: 2,
    CONNECTING: 3,
    CONNECTED: 3 };

  var DEFAULT_URL = "http://localhost:8888";
  var DEFAULT_CACHE_SIZE = 1000;
  var DEFAULT_CACHE_AGE = 3600000;
  var DEFAULT_REQUEST_TIMEOUT = 10000;

  var Client = function Client(engine, options) {
    options = options || {};
    _.dev(function () {
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
      _url: options.url || DEFAULT_URL });
    this.engine.requester = new Requester(this._url, {
      max: options.cacheSize || DEFAULT_CACHE_SIZE,
      maxAge: options.cacheAge || DEFAULT_CACHE_AGE,
      timeout: options.requestTimeout || DEFAULT_REQUEST_TIMEOUT });
  };

  Client.prototype.start = function () {
    var _this = this;
    _.dev(function () {
      _this._status.should.be.exactly(CLIENT_STATUS.NOT_STARTED);
      (_this._failedAttempts === null).should.be.ok;
    });
    this._failedAttempts = 0;
    this._status = CLIENT_STATUS.BACKING_OFF;
    // Not a typo, we actually want to use setTimeout(0), not setImmediate,
    // because we want it to be symmetrical with _handleConnectionFailure.
    this._reconnectTimeout = setTimeout(function () {
      return _this._connect();
    }, 0);
  };

  Client.prototype._connect = function () {
    var _this2 = this;
    _.dev(function () {
      _this2._url.should.be.a.String;
      (_this2._reconnectTimeout !== null).should.be.ok;
      _this2._status.should.be.exactly(CLIENT_STATUS.BACKING_OFF);
      (_this2._socket === null).should.be.ok;
    });
    this._reconnectTimeout = null;
    this._status = CLIENT_STATUS.CONNECTING;
    var socket = EngineIOClient(this._url);
    socket.on("open", function () {
      return _this2._handleConnectionSuccess();
    });
    socket.on("close", function () {
      if (_this2._status === CLIENT_STATUS.CONNECTING) {
        _this2._handleConnectionFailure();
      } else {
        _this2._handleDisconnection();
      }
    });
    socket.on("message", function (message) {
      return _this2._handleMessage(message);
    });
    socket.on("error", function (err) {
      return _this2._handleError(err);
    });
    this._socket = socket;
  };

  Client.prototype._handleConnectionFailure = function () {
    var _this3 = this;
    _.dev(function () {
      (_this3._socket !== null).should.be.ok;
      _this3._status.should.be.exactly(CLIENT_STATUS.CONNECTING);
      _this3._failedAttempts.should.be.a.Number;
      (_this3._reconnectTimeout === null).should.be.ok;
    });
    this._socket = null;
    this._status = CLIENT_STATUS.BACKING_OFF;
    this._failedAttempts = this._failedAttempts + 1;
    var backOffFor = Math.min(this._initial * Math.pow(this._backOff, this._failedAttempts - 1), this._ceil);
    this._reconnectTimeout = setTimeout(function () {
      return _this3._connect();
    }, backOffFor);
  };

  Client.prototype._handleConnectionSuccess = function () {
    var _this4 = this;
    _.dev(function () {
      _this4._status.should.be.exactly(CLIENT_STATUS.CONNECTING);
      _this4._failedAttempts.should.be.a.Number;
    });
    // Reset failed attempts counter
    this._failedAttempts = null;
    this._engine.handleConnection(this._socket);
  };

  Client.prototype._handleDisconnection = function () {
    var _this5 = this;
    _.dev(function () {
      _this5._status.should.be.exactly(CLIENT_STATUS.CONNECTED);
      (_this5._failedAttempts === null).should.be.ok;
    });
    this._engine.handleDisconnection();
    this._status = CLIENT_STATUS.BACKING_OFF;
    this._failedAttempts = 0;
    this._connect();
  };

  Client.prototype._handleMessage = function (message) {
    var _this6 = this;
    _.dev(function () {
      _this6._status.should.be.exactly(CLIENT_STATUS.CONNECTED);
      message.should.be.a.String;
    });
    this._engine.handleMessage(message);
  };

  Client.prototype._handleError = function (err) {
    _.dev(function () {
      return console.warn("Socket $error:", err);
    });
  };

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
    _url: null });

  return Client;
};