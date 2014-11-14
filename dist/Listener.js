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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImc6L3JlYWN0LW5leHVzL25leHVzLXVwbGluay1jbGllbnQvc3JjL0xpc3RlbmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDekIsSUFBSSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ2xDLElBQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNqQyxJQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDOztJQUVsQixRQUFRO01BQVIsUUFBUSxHQUNELFNBRFAsUUFBUSxPQUNtQjtRQUFqQixJQUFJLFFBQUosSUFBSTtRQUFFLE9BQU8sUUFBUCxPQUFPO0FBQ3pCLEtBQUMsQ0FBQyxHQUFHLENBQUM7YUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUNqQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUTtLQUFBLENBQzdCLENBQUM7QUFDRixLQUFDLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsT0FBTyxFQUFQLE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7R0FDekQ7O2NBTkcsUUFBUTtBQVFaLFNBQUs7O2FBQUEsVUFBQyxTQUFTLEVBQUU7O0FBQ2YsU0FBQyxDQUFDLEdBQUcsQ0FBQztpQkFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTTtTQUFBLENBQUMsQ0FBQztBQUMzQyxZQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtBQUMxQixtQkFBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7U0FDN0I7QUFDRCxTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLFNBQVMsQ0FBQyxNQUFLLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sSUFDcEQsU0FBUyxDQUFDLE1BQUssTUFBTSxDQUFDLENBQUMsTUFBSyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1NBQUEsQ0FDakQsQ0FBQztBQUNGLGlCQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDdkMsZUFBTyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO09BQ3pEOztBQUVELGNBQVU7O2FBQUEsVUFBQyxTQUFTLEVBQUU7O0FBQ3BCLFNBQUMsQ0FBQyxHQUFHLENBQUM7aUJBQU0sU0FBUyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sSUFDdkMsU0FBUyxDQUFDLE9BQUssTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxJQUMxQyxTQUFTLENBQUMsT0FBSyxNQUFNLENBQUMsQ0FBQyxPQUFLLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxRQUFNO1NBQUEsQ0FDeEQsQ0FBQztBQUNGLGVBQU8sU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdkMsWUFBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ25ELGlCQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDOUIsaUJBQU8sSUFBSSxDQUFDO1NBQ2I7QUFDRCxlQUFPLEtBQUssQ0FBQztPQUNkOztBQUVELFFBQUk7O2FBQUEsVUFBQyxNQUFNLEVBQUU7QUFDWCxTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNO1NBQUEsQ0FBQyxDQUFDO0FBQ3hDLFlBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztPQUNqQzs7OztTQXBDRyxRQUFROzs7QUF1Q2QsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFO0FBQzNCLE1BQUksRUFBRSxJQUFJO0FBQ1YsU0FBTyxFQUFFLElBQUk7QUFDYixJQUFFLEVBQUUsSUFBSSxFQUNULENBQUMsQ0FBQzs7QUFFSCxNQUFNLENBQUMsT0FBTyxHQUFHLFFBQVEsQ0FBQyIsImZpbGUiOiJMaXN0ZW5lci5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbmNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xyXG5jb25zdCBzaG91bGQgPSBfLnNob3VsZDtcclxuXHJcbmNsYXNzIExpc3RlbmVyIHtcclxuICBjb25zdHJ1Y3Rvcih7IHJvb20sIGhhbmRsZXIgfSkge1xyXG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcclxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvblxyXG4gICAgKTtcclxuICAgIF8uZXh0ZW5kKHRoaXMsIHsgcm9vbSwgaGFuZGxlciwgaWQ6IF8udW5pcXVlSWQocm9vbSkgfSk7XHJcbiAgfVxyXG5cclxuICBhZGRUbyhsaXN0ZW5lcnMpIHtcclxuICAgIF8uZGV2KCgpID0+IGxpc3RlbmVycy5zaG91bGQuYmUuYW4uT2JqZWN0KTtcclxuICAgIGlmKCFsaXN0ZW5lcnNbdGhpcy5hY3Rpb25dKSB7XHJcbiAgICAgIGxpc3RlbmVyc1t0aGlzLmFjdGlvbl0gPSB7fTtcclxuICAgIH1cclxuICAgIF8uZGV2KCgpID0+IGxpc3RlbmVyc1t0aGlzLmFjdGlvbl0uc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxyXG4gICAgICBsaXN0ZW5lcnNbdGhpcy5hY3Rpb25dW3RoaXMuaWRdLnNob3VsZC5ub3QuYmUub2tcclxuICAgICk7XHJcbiAgICBsaXN0ZW5lcnNbdGhpcy5hY3Rpb25dW3RoaXMuaWRdID0gdGhpcztcclxuICAgIHJldHVybiBPYmplY3Qua2V5cyhsaXN0ZW5lcnNbdGhpcy5hY3Rpb25dKS5sZW5ndGggPT09IDE7XHJcbiAgfVxyXG5cclxuICByZW1vdmVGcm9tKGxpc3RlbmVycykge1xyXG4gICAgXy5kZXYoKCkgPT4gbGlzdGVuZXJzLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcclxuICAgICAgbGlzdGVuZXJzW3RoaXMuYWN0aW9uXS5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXHJcbiAgICAgIGxpc3RlbmVyc1t0aGlzLmFjdGlvbl1bdGhpcy5pZF0uc2hvdWxkLmJlLmV4YWN0bHkodGhpcylcclxuICAgICk7XHJcbiAgICBkZWxldGUgbGlzdGVuZXJzW3RoaXMuYWN0aW9uXVt0aGlzLmlkXTtcclxuICAgIGlmKE9iamVjdC5rZXlzKGxpc3RlbmVyc1t0aGlzLmFjdGlvbl0pLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICBkZWxldGUgbGlzdGVuZXJzW3RoaXMuYWN0aW9uXTtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG5cclxuICBlbWl0KHBhcmFtcykge1xyXG4gICAgXy5kZXYoKCkgPT4gcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3QpO1xyXG4gICAgdGhpcy5oYW5kbGVyLmNhbGwobnVsbCwgcGFyYW1zKTtcclxuICB9XHJcbn1cclxuXHJcbl8uZXh0ZW5kKExpc3RlbmVyLnByb3RvdHlwZSwge1xyXG4gIHJvb206IG51bGwsXHJcbiAgaGFuZGxlcjogbnVsbCxcclxuICBpZDogbnVsbCxcclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IExpc3RlbmVyO1xyXG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=