"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = require("bluebird");var __DEV__ = (process.env.NODE_ENV !== "production");
var _ = require("lodash-next");

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1jbGllbnQvc3JjL0xpc3RlbmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUMsQUFBQyxJQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQUFBQyxJQUFNLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxLQUFLLFlBQVksQ0FBQyxDQUFDO0FBQ3ZILElBQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQzs7SUFFM0IsUUFBUTtNQUFSLFFBQVEsR0FDRCxTQURQLFFBQVEsT0FDbUI7UUFBakIsSUFBSSxRQUFKLElBQUk7UUFBRSxPQUFPLFFBQVAsT0FBTztBQUN6QixLQUFDLENBQUMsR0FBRyxDQUFDO2FBQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFDakMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVE7S0FBQSxDQUM3QixDQUFDO0FBQ0YsS0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLE9BQU8sRUFBUCxPQUFPLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0dBQ3pEOztjQU5HLFFBQVE7QUFRWixTQUFLOzthQUFBLFVBQUMsU0FBUyxFQUFFOztBQUNmLFNBQUMsQ0FBQyxHQUFHLENBQUM7aUJBQU0sU0FBUyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU07U0FBQSxDQUFDLENBQUM7QUFDM0MsWUFBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFDMUIsbUJBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO1NBQzdCO0FBQ0QsU0FBQyxDQUFDLEdBQUcsQ0FBQztpQkFBTSxTQUFTLENBQUMsTUFBSyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNLElBQ3BELFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBSyxFQUFFLENBQUM7U0FBQSxDQUM1QyxDQUFDO0FBQ0YsaUJBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUN2QyxlQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUM7T0FDekQ7O0FBRUQsY0FBVTs7YUFBQSxVQUFDLFNBQVMsRUFBRTs7QUFDcEIsU0FBQyxDQUFDLEdBQUcsQ0FBQztpQkFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxJQUN2QyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBSyxNQUFNLENBQUMsSUFDM0MsU0FBUyxDQUFDLE9BQUssTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxJQUMxQyxTQUFTLENBQUMsT0FBSyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFLLEVBQUUsU0FBTztTQUFBLENBQzNELENBQUM7QUFDRixlQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3ZDLFlBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUNuRCxpQkFBTyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzlCLGlCQUFPLElBQUksQ0FBQztTQUNiO0FBQ0QsZUFBTyxLQUFLLENBQUM7T0FDZDs7QUFFRCxRQUFJOzthQUFBLFVBQUMsTUFBTSxFQUFFO0FBQ1gsU0FBQyxDQUFDLEdBQUcsQ0FBQztpQkFBTSxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTTtTQUFBLENBQUMsQ0FBQztBQUN4QyxZQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7T0FDakM7Ozs7U0FyQ0csUUFBUTs7O0FBd0NkLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRTtBQUMzQixNQUFJLEVBQUUsSUFBSTtBQUNWLFNBQU8sRUFBRSxJQUFJO0FBQ2IsSUFBRSxFQUFFLElBQUksRUFDVCxDQUFDLENBQUM7O0FBRUgsTUFBTSxDQUFDLE9BQU8sR0FBRyxRQUFRLENBQUMiLCJmaWxlIjoiTGlzdGVuZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJyZXF1aXJlKCc2dG81L3BvbHlmaWxsJyk7IGNvbnN0IFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpOyBjb25zdCBfX0RFVl9fID0gKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpO1xuY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XG5cbmNsYXNzIExpc3RlbmVyIHtcbiAgY29uc3RydWN0b3IoeyByb29tLCBoYW5kbGVyIH0pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgXy5leHRlbmQodGhpcywgeyByb29tLCBoYW5kbGVyLCBpZDogXy51bmlxdWVJZChyb29tKSB9KTtcbiAgfVxuXG4gIGFkZFRvKGxpc3RlbmVycykge1xuICAgIF8uZGV2KCgpID0+IGxpc3RlbmVycy5zaG91bGQuYmUuYW4uT2JqZWN0KTtcbiAgICBpZighbGlzdGVuZXJzW3RoaXMuYWN0aW9uXSkge1xuICAgICAgbGlzdGVuZXJzW3RoaXMuYWN0aW9uXSA9IHt9O1xuICAgIH1cbiAgICBfLmRldigoKSA9PiBsaXN0ZW5lcnNbdGhpcy5hY3Rpb25dLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIGxpc3RlbmVycy5zaG91bGQubm90LmhhdmUucHJvcGVydHkodGhpcy5pZClcbiAgICApO1xuICAgIGxpc3RlbmVyc1t0aGlzLmFjdGlvbl1bdGhpcy5pZF0gPSB0aGlzO1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhsaXN0ZW5lcnNbdGhpcy5hY3Rpb25dKS5sZW5ndGggPT09IDE7XG4gIH1cblxuICByZW1vdmVGcm9tKGxpc3RlbmVycykge1xuICAgIF8uZGV2KCgpID0+IGxpc3RlbmVycy5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICBsaXN0ZW5lcnMuc2hvdWxkLmhhdmUucHJvcGVydHkodGhpcy5hY3Rpb24pICYmXG4gICAgICBsaXN0ZW5lcnNbdGhpcy5hY3Rpb25dLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIGxpc3RlbmVyc1t0aGlzLmFjdGlvbl0uc2hvdWxkLmhhdmUucHJvcGVydHkodGhpcy5pZCwgdGhpcylcbiAgICApO1xuICAgIGRlbGV0ZSBsaXN0ZW5lcnNbdGhpcy5hY3Rpb25dW3RoaXMuaWRdO1xuICAgIGlmKE9iamVjdC5rZXlzKGxpc3RlbmVyc1t0aGlzLmFjdGlvbl0pLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVsZXRlIGxpc3RlbmVyc1t0aGlzLmFjdGlvbl07XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZW1pdChwYXJhbXMpIHtcbiAgICBfLmRldigoKSA9PiBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdCk7XG4gICAgdGhpcy5oYW5kbGVyLmNhbGwobnVsbCwgcGFyYW1zKTtcbiAgfVxufVxuXG5fLmV4dGVuZChMaXN0ZW5lci5wcm90b3R5cGUsIHtcbiAgcm9vbTogbnVsbCxcbiAgaGFuZGxlcjogbnVsbCxcbiAgaWQ6IG51bGwsXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBMaXN0ZW5lcjtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==