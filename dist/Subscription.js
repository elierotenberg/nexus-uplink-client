"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");
var Promise = require("bluebird");
var _ = require("lodash-next");
var should = _.should;

var Subscription = (function () {
  var Subscription = function Subscription(_ref) {
    var path = _ref.path;
    var handler = _ref.handler;
    _.dev(function () {
      return path.should.be.a.String && handler.should.be.a.Function;
    });
    _.extend(this, { path: path, handler: handler, id: _.uniqueId(path) });
  };

  _classProps(Subscription, null, {
    addTo: {
      writable: true,
      value: function (subscriptions) {
        var _this = this;
        _.dev(function () {
          return subscriptions.should.be.an.Object;
        });
        if (!subscriptions[this.path]) {
          subscriptions[this.path] = {};
        }
        _.dev(function () {
          return subscriptions[_this.path].should.be.an.Object && subscriptions[_this.path][_this.id].should.not.be.ok;
        });
        subscriptions[this.path][this.id] = this;
        return Object.keys(subscriptions[this.path]).length === 1;
      }
    },
    removeFrom: {
      writable: true,
      value: function (subscriptions) {
        var _this2 = this;
        _.dev(function () {
          return subscriptions.should.be.an.Object && subscriptions[_this2.path].shoulbe.be.an.Object && subscriptions[_this2.path][_this2.id].should.be.exactly(_this2);
        });
        delete subscriptions[this.path][this.id];
        if (Object.keys(subscriptions[this.path]).length === 0) {
          delete subscriptions[this.path];
          return true;
        }
        return false;
      }
    },
    update: {
      writable: true,
      value: function (value) {
        _.dev(function () {
          return (value === null || _.isObject(value)).should.be.ok;
        });
        this.handler.call(null, value);
      }
    }
  });

  return Subscription;
})();

_.extend(Subscription.prototype, {
  path: null,
  handler: null,
  id: null });

module.exports = Subscription;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImM6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1jbGllbnQvc3JjL1N1YnNjcmlwdGlvbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNsQyxJQUFNLENBQUMsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDakMsSUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQzs7SUFFbEIsWUFBWTtNQUFaLFlBQVksR0FDTixTQUROLFlBQVksT0FDYztRQUFqQixJQUFJLFFBQUosSUFBSTtRQUFFLE9BQU8sUUFBUCxPQUFPO0FBQ3hCLEtBQUMsQ0FBQyxHQUFHLENBQUM7YUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUNqQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUTtLQUFBLENBQzdCLENBQUM7QUFDRixLQUFDLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsT0FBTyxFQUFQLE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7R0FDMUQ7O2NBTkksWUFBWTtBQVFoQixTQUFLOzthQUFBLFVBQUMsYUFBYSxFQUFFOztBQUNuQixTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLGFBQWEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNO1NBQUEsQ0FBQyxDQUFDO0FBQy9DLFlBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQzVCLHVCQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztTQUMvQjtBQUNELFNBQUMsQ0FBQyxHQUFHLENBQUM7aUJBQU0sYUFBYSxDQUFDLE1BQUssSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxJQUN0RCxhQUFhLENBQUMsTUFBSyxJQUFJLENBQUMsQ0FBQyxNQUFLLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUU7U0FBQSxDQUNuRCxDQUFDO0FBQ0YscUJBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUN6QyxlQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUM7T0FDM0Q7O0FBRUQsY0FBVTs7YUFBQSxVQUFDLGFBQWEsRUFBRTs7QUFDeEIsU0FBQyxDQUFDLEdBQUcsQ0FBQztpQkFBTSxhQUFhLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxJQUMzQyxhQUFhLENBQUMsT0FBSyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNLElBQzdDLGFBQWEsQ0FBQyxPQUFLLElBQUksQ0FBQyxDQUFDLE9BQUssRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLFFBQU07U0FBQSxDQUMxRCxDQUFDO0FBQ0YsZUFBTyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN6QyxZQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDckQsaUJBQU8sYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoQyxpQkFBTyxJQUFJLENBQUM7U0FDYjtBQUNELGVBQU8sS0FBSyxDQUFDO09BQ2Q7O0FBRUQsVUFBTTs7YUFBQSxVQUFDLEtBQUssRUFBRTtBQUNaLFNBQUMsQ0FBQyxHQUFHLENBQUM7aUJBQU0sQ0FBQyxLQUFLLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUU7U0FBQSxDQUFDLENBQUM7QUFDaEUsWUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO09BQ2hDOzs7O1NBcENHLFlBQVk7OztBQXVDbEIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFO0FBQ2hDLE1BQUksRUFBRSxJQUFJO0FBQ1QsU0FBTyxFQUFFLElBQUk7QUFDZCxJQUFFLEVBQUUsSUFBSSxFQUNSLENBQUMsQ0FBQzs7QUFFSCxNQUFNLENBQUMsT0FBTyxHQUFHLFlBQVksQ0FBQyIsImZpbGUiOiJTdWJzY3JpcHRpb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyJyZXF1aXJlKCc2dG81L3BvbHlmaWxsJyk7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJ2JsdWViaXJkJyk7XG5jb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcbmNvbnN0IHNob3VsZCA9IF8uc2hvdWxkO1xuXG5jbGFzcyBTdWJzY3JpcHRpb24ge1xuXHRjb25zdHJ1Y3Rvcih7IHBhdGgsIGhhbmRsZXIgfSkge1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uXG4gICAgKTtcbiAgICBfLmV4dGVuZCh0aGlzLCB7IHBhdGgsIGhhbmRsZXIsIGlkOiBfLnVuaXF1ZUlkKHBhdGgpIH0pO1xuXHR9XG5cbiAgYWRkVG8oc3Vic2NyaXB0aW9ucykge1xuICAgIF8uZGV2KCgpID0+IHN1YnNjcmlwdGlvbnMuc2hvdWxkLmJlLmFuLk9iamVjdCk7XG4gICAgaWYoIXN1YnNjcmlwdGlvbnNbdGhpcy5wYXRoXSkge1xuICAgICAgc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdID0ge307XG4gICAgfVxuICAgIF8uZGV2KCgpID0+IHN1YnNjcmlwdGlvbnNbdGhpcy5wYXRoXS5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICBzdWJzY3JpcHRpb25zW3RoaXMucGF0aF1bdGhpcy5pZF0uc2hvdWxkLm5vdC5iZS5va1xuICAgICk7XG4gICAgc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdW3RoaXMuaWRdID0gdGhpcztcbiAgICByZXR1cm4gT2JqZWN0LmtleXMoc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdKS5sZW5ndGggPT09IDE7XG4gIH1cblxuICByZW1vdmVGcm9tKHN1YnNjcmlwdGlvbnMpIHtcbiAgICBfLmRldigoKSA9PiBzdWJzY3JpcHRpb25zLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIHN1YnNjcmlwdGlvbnNbdGhpcy5wYXRoXS5zaG91bGJlLmJlLmFuLk9iamVjdCAmJlxuICAgICAgc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdW3RoaXMuaWRdLnNob3VsZC5iZS5leGFjdGx5KHRoaXMpXG4gICAgKTtcbiAgICBkZWxldGUgc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdW3RoaXMuaWRdO1xuICAgIGlmKE9iamVjdC5rZXlzKHN1YnNjcmlwdGlvbnNbdGhpcy5wYXRoXSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHVwZGF0ZSh2YWx1ZSkge1xuICAgIF8uZGV2KCgpID0+ICh2YWx1ZSA9PT0gbnVsbCB8fCBfLmlzT2JqZWN0KHZhbHVlKSkuc2hvdWxkLmJlLm9rKTtcbiAgICB0aGlzLmhhbmRsZXIuY2FsbChudWxsLCB2YWx1ZSk7XG4gIH1cbn1cblxuXy5leHRlbmQoU3Vic2NyaXB0aW9uLnByb3RvdHlwZSwge1xuXHRwYXRoOiBudWxsLFxuICBoYW5kbGVyOiBudWxsLFxuXHRpZDogbnVsbCxcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN1YnNjcmlwdGlvbjtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==