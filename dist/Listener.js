"use strict";

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = process.env.NODE_ENV !== "production";var __PROD__ = !__DEV__;var __BROWSER__ = typeof window === "object";var __NODE__ = !__BROWSER__;var _ = require("lodash-next");

var Listener = function Listener(_ref) {
  var room = _ref.room;
  var handler = _ref.handler;
  _.dev(function () {
    return room.should.be.a.String && handler.should.be.a.Function;
  });
  _.extend(this, { room: room, handler: handler, id: _.uniqueId(room) });
};

Listener.prototype.addTo = function (listeners) {
  var _this = this;
  _.dev(function () {
    return listeners.should.be.an.Object;
  });
  if (!listeners[this.action]) {
    listeners[this.action] = {};
  }
  _.dev(function () {
    return listeners[_this.action].should.be.an.Object && (listeners[_this.id] === void 0).should.be.ok;
  });
  listeners[this.action][this.id] = this;
  return Object.keys(listeners[this.action]).length === 1;
};

Listener.prototype.removeFrom = function (listeners) {
  var _this2 = this;
  _.dev(function () {
    return listeners.should.be.an.Object && (listeners[_this2.action] !== void 0).should.be.ok && listeners[_this2.action].should.be.an.Object && (listeners[_this2.action][_this2.id] !== void 0).should.be.ok && listeners[_this2.action][_this2.id].should.be.exactly(_this2);
  });
  delete listeners[this.action][this.id];
  if (Object.keys(listeners[this.action]).length === 0) {
    delete listeners[this.action];
    return true;
  }
  return false;
};

Listener.prototype.emit = function (params) {
  _.dev(function () {
    return params.should.be.an.Object;
  });
  this.handler.call(null, params);
};

_.extend(Listener.prototype, {
  room: null,
  handler: null,
  id: null });

module.exports = Listener;