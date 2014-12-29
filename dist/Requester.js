"use strict";

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = process.env.NODE_ENV !== "production";var __PROD__ = !__DEV__;var __BROWSER__ = typeof window === "object";var __NODE__ = !__BROWSER__;var _ = require("lodash-next");
var superagent = require("superagent");

var DEFAULT_TIMEOUT = 10000;

function promisify(req) {
  return new Promise(function (resolve, reject) {
    return req.end(function (err, res) {
      if (err) {
        return reject(err);
      }
      if (res.error) {
        return reject(res.error);
      }
      resolve(res.body);
    });
  });
}

/**
 * Promise-based wrapper with avoid running the same request twice concurrently.
 * Also allows to abort/timeout fluently.
 */
/**
 * Promise-based wrapper with avoid running the same request twice concurrently.
 * Also allows to abort/timeout fluently.
 */var Requester = function Requester(_ref) {
  var _this = this;
  var requestTimeout = _ref.requestTimeout;
  this.requestTimeout = requestTimeout || DEFAULT_TIMEOUT;
  _.dev(function () {
    return _this.requestTimeout.should.be.a.Number.and.not.be.below(0);
  });
  this.cache = {};
};

// Public methods

Requester.prototype.destroy = function () {
  var _this2 = this;
  // Will implicitly call delete this.cache[url]
  Object.keys(this.cache).forEach(function (url) {
    return _this2.cache[url].cancel(new Error("Requester destroyed"));
  });
  this.cache = null;
};

Requester.prototype.get = function (url) {
  var _this3 = this;
  _.dev(function () {
    return url.should.be.a.String;
  });
  if (!this.cache[url]) {
    this.cache[url] = this._createRequest(superagent.get(url).accept("application/json"))["finally"](function () {
      delete _this3.cache[url];
    });
  }
  return this.cache[url];
};

Requester.prototype.abort = function (url) {
  _.dev(function () {
    return url.should.be.a.String;
  });
  if (this.cache[url]) {
    this.cache[url].cancel(new Error("Aborted"));
  }
};

Requester.prototype.post = function (url, params) {
  params = params || {};
  _.dev(function () {
    return url.should.be.a.String && params.should.be.an.Object;
  });
  return this._createRequest(superagent.post(url).type("json").send(params));
};

// Private methods

Requester.prototype._createRequest = function (req) {
  return promisify(req).cancellable().timeout(this.requestTimeout)["catch"](Promise.TimeoutError, Promise.CancellationError, function (err) {
    // Abort the request and rethrow
    req.abort();
    throw err;
  });
};

_.extend(Requester.prototype, {
  requestTimeout: null,
  cache: null });

module.exports = Requester;