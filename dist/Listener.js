"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");
var Promise = require("bluebird");
var _ = require("lodash-next");
var should = _.should;

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
          return listeners[_this.action].should.be.an.Object && listeners[_this.action][_this.id].should.not.be.ok;
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
          return listeners.should.be.an.Object && listeners[_this2.action].should.be.an.Object && listeners[_this2.action][_this2.id].should.be.exactly(_this2);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImM6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1jbGllbnQvc3JjL0xpc3RlbmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDekIsSUFBSSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ2xDLElBQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNqQyxJQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDOztJQUVsQixRQUFRO01BQVIsUUFBUSxHQUNELFNBRFAsUUFBUSxPQUNtQjtRQUFqQixJQUFJLFFBQUosSUFBSTtRQUFFLE9BQU8sUUFBUCxPQUFPO0FBQ3pCLEtBQUMsQ0FBQyxHQUFHLENBQUM7YUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUNqQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUTtLQUFBLENBQzdCLENBQUM7QUFDRixLQUFDLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsT0FBTyxFQUFQLE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7R0FDekQ7O2NBTkcsUUFBUTtBQVFaLFNBQUs7O2FBQUEsVUFBQyxTQUFTLEVBQUU7O0FBQ2YsU0FBQyxDQUFDLEdBQUcsQ0FBQztpQkFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTTtTQUFBLENBQUMsQ0FBQztBQUMzQyxZQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtBQUMxQixtQkFBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7U0FDN0I7QUFDRCxTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLFNBQVMsQ0FBQyxNQUFLLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sSUFDcEQsU0FBUyxDQUFDLE1BQUssTUFBTSxDQUFDLENBQUMsTUFBSyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1NBQUEsQ0FDakQsQ0FBQztBQUNGLGlCQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDdkMsZUFBTyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO09BQ3pEOztBQUVELGNBQVU7O2FBQUEsVUFBQyxTQUFTLEVBQUU7O0FBQ3BCLFNBQUMsQ0FBQyxHQUFHLENBQUM7aUJBQU0sU0FBUyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sSUFDdkMsU0FBUyxDQUFDLE9BQUssTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxJQUMxQyxTQUFTLENBQUMsT0FBSyxNQUFNLENBQUMsQ0FBQyxPQUFLLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxRQUFNO1NBQUEsQ0FDeEQsQ0FBQztBQUNGLGVBQU8sU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdkMsWUFBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ25ELGlCQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDOUIsaUJBQU8sSUFBSSxDQUFDO1NBQ2I7QUFDRCxlQUFPLEtBQUssQ0FBQztPQUNkOztBQUVELFFBQUk7O2FBQUEsVUFBQyxNQUFNLEVBQUU7QUFDWCxTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNO1NBQUEsQ0FBQyxDQUFDO0FBQ3hDLFlBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztPQUNqQzs7OztTQXBDRyxRQUFROzs7QUF1Q2QsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFO0FBQzNCLE1BQUksRUFBRSxJQUFJO0FBQ1YsU0FBTyxFQUFFLElBQUk7QUFDYixJQUFFLEVBQUUsSUFBSSxFQUNULENBQUMsQ0FBQzs7QUFFSCxNQUFNLENBQUMsT0FBTyxHQUFHLFFBQVEsQ0FBQyIsImZpbGUiOiJMaXN0ZW5lci5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbmNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuY29uc3Qgc2hvdWxkID0gXy5zaG91bGQ7XG5cbmNsYXNzIExpc3RlbmVyIHtcbiAgY29uc3RydWN0b3IoeyByb29tLCBoYW5kbGVyIH0pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgXy5leHRlbmQodGhpcywgeyByb29tLCBoYW5kbGVyLCBpZDogXy51bmlxdWVJZChyb29tKSB9KTtcbiAgfVxuXG4gIGFkZFRvKGxpc3RlbmVycykge1xuICAgIF8uZGV2KCgpID0+IGxpc3RlbmVycy5zaG91bGQuYmUuYW4uT2JqZWN0KTtcbiAgICBpZighbGlzdGVuZXJzW3RoaXMuYWN0aW9uXSkge1xuICAgICAgbGlzdGVuZXJzW3RoaXMuYWN0aW9uXSA9IHt9O1xuICAgIH1cbiAgICBfLmRldigoKSA9PiBsaXN0ZW5lcnNbdGhpcy5hY3Rpb25dLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIGxpc3RlbmVyc1t0aGlzLmFjdGlvbl1bdGhpcy5pZF0uc2hvdWxkLm5vdC5iZS5va1xuICAgICk7XG4gICAgbGlzdGVuZXJzW3RoaXMuYWN0aW9uXVt0aGlzLmlkXSA9IHRoaXM7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGxpc3RlbmVyc1t0aGlzLmFjdGlvbl0pLmxlbmd0aCA9PT0gMTtcbiAgfVxuXG4gIHJlbW92ZUZyb20obGlzdGVuZXJzKSB7XG4gICAgXy5kZXYoKCkgPT4gbGlzdGVuZXJzLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIGxpc3RlbmVyc1t0aGlzLmFjdGlvbl0uc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgbGlzdGVuZXJzW3RoaXMuYWN0aW9uXVt0aGlzLmlkXS5zaG91bGQuYmUuZXhhY3RseSh0aGlzKVxuICAgICk7XG4gICAgZGVsZXRlIGxpc3RlbmVyc1t0aGlzLmFjdGlvbl1bdGhpcy5pZF07XG4gICAgaWYoT2JqZWN0LmtleXMobGlzdGVuZXJzW3RoaXMuYWN0aW9uXSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgbGlzdGVuZXJzW3RoaXMuYWN0aW9uXTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBlbWl0KHBhcmFtcykge1xuICAgIF8uZGV2KCgpID0+IHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0KTtcbiAgICB0aGlzLmhhbmRsZXIuY2FsbChudWxsLCBwYXJhbXMpO1xuICB9XG59XG5cbl8uZXh0ZW5kKExpc3RlbmVyLnByb3RvdHlwZSwge1xuICByb29tOiBudWxsLFxuICBoYW5kbGVyOiBudWxsLFxuICBpZDogbnVsbCxcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IExpc3RlbmVyO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9