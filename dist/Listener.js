"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var __NODE__ = !__BROWSER__;var __BROWSER__ = (typeof window === "object");var __PROD__ = !__DEV__;var __DEV__ = (process.env.NODE_ENV !== "production");var Promise = require("lodash-next").Promise;require("6to5/polyfill");var _ = require("lodash-next");

var Listener = (function () {
  var Listener = function Listener(_ref) {
    var room = _ref.room;
    var handler = _ref.handler;
    _.dev(function () {
      return room.should.be.a.String && handler.should.be.a.Function;
    });
    _.extend(this, { room: room, handler: handler, id: _.uniqueId(room) });
  };

  _classProps(Listener, null, {
    addTo: {
      writable: true,
      value: function (listeners) {
        var _this = this;
        _.dev(function () {
          return listeners.should.be.an.Object;
        });
        if (!listeners[this.action]) {
          listeners[this.action] = {};
        }
        _.dev(function () {
          return listeners[_this.action].should.be.an.Object && listeners.should.not.have.property(_this.id);
        });
        listeners[this.action][this.id] = this;
        return Object.keys(listeners[this.action]).length === 1;
      }
    },
    removeFrom: {
      writable: true,
      value: function (listeners) {
        var _this2 = this;
        _.dev(function () {
          return listeners.should.be.an.Object && listeners.should.have.property(_this2.action) && listeners[_this2.action].should.be.an.Object && listeners[_this2.action].should.have.property(_this2.id, _this2);
        });
        delete listeners[this.action][this.id];
        if (Object.keys(listeners[this.action]).length === 0) {
          delete listeners[this.action];
          return true;
        }
        return false;
      }
    },
    emit: {
      writable: true,
      value: function (params) {
        _.dev(function () {
          return params.should.be.an.Object;
        });
        this.handler.call(null, params);
      }
    }
  });

  return Listener;
})();

_.extend(Listener.prototype, {
  room: null,
  handler: null,
  id: null });

module.exports = Listener;