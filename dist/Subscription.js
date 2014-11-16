"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");
var Promise = require("bluebird");
var _ = require("lodash-next");

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImc6L3JlYWN0LW5leHVzL25leHVzLXVwbGluay1jbGllbnQvc3JjL1N1YnNjcmlwdGlvbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNsQyxJQUFNLENBQUMsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7O0lBRTNCLFlBQVk7TUFBWixZQUFZLEdBQ04sU0FETixZQUFZLE9BQ2M7UUFBakIsSUFBSSxRQUFKLElBQUk7UUFBRSxPQUFPLFFBQVAsT0FBTztBQUN4QixLQUFDLENBQUMsR0FBRyxDQUFDO2FBQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFDakMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVE7S0FBQSxDQUM3QixDQUFDO0FBQ0YsS0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLE9BQU8sRUFBUCxPQUFPLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0dBQzFEOztjQU5JLFlBQVk7QUFRaEIsU0FBSzs7YUFBQSxVQUFDLGFBQWEsRUFBRTs7QUFDbkIsU0FBQyxDQUFDLEdBQUcsQ0FBQztpQkFBTSxhQUFhLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTTtTQUFBLENBQUMsQ0FBQztBQUMvQyxZQUFHLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUM1Qix1QkFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7U0FDL0I7QUFDRCxTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLGFBQWEsQ0FBQyxNQUFLLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sSUFDdEQsYUFBYSxDQUFDLE1BQUssSUFBSSxDQUFDLENBQUMsTUFBSyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1NBQUEsQ0FDbkQsQ0FBQztBQUNGLHFCQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDekMsZUFBTyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO09BQzNEOztBQUVELGNBQVU7O2FBQUEsVUFBQyxhQUFhLEVBQUU7O0FBQ3hCLFNBQUMsQ0FBQyxHQUFHLENBQUM7aUJBQU0sYUFBYSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sSUFDM0MsYUFBYSxDQUFDLE9BQUssSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxJQUM3QyxhQUFhLENBQUMsT0FBSyxJQUFJLENBQUMsQ0FBQyxPQUFLLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxRQUFNO1NBQUEsQ0FDMUQsQ0FBQztBQUNGLGVBQU8sYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDekMsWUFBRyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ3JELGlCQUFPLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEMsaUJBQU8sSUFBSSxDQUFDO1NBQ2I7QUFDRCxlQUFPLEtBQUssQ0FBQztPQUNkOztBQUVELFVBQU07O2FBQUEsVUFBQyxLQUFLLEVBQUU7QUFDWixTQUFDLENBQUMsR0FBRyxDQUFDO2lCQUFNLENBQUMsS0FBSyxLQUFLLElBQUksSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1NBQUEsQ0FBQyxDQUFDO0FBQ2hFLFlBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztPQUNoQzs7OztTQXBDRyxZQUFZOzs7QUF1Q2xCLENBQUMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRTtBQUNoQyxNQUFJLEVBQUUsSUFBSTtBQUNULFNBQU8sRUFBRSxJQUFJO0FBQ2QsSUFBRSxFQUFFLElBQUksRUFDUixDQUFDLENBQUM7O0FBRUgsTUFBTSxDQUFDLE9BQU8sR0FBRyxZQUFZLENBQUMiLCJmaWxlIjoiU3Vic2NyaXB0aW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsicmVxdWlyZSgnNnRvNS9wb2x5ZmlsbCcpO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xuY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XG5cbmNsYXNzIFN1YnNjcmlwdGlvbiB7XG5cdGNvbnN0cnVjdG9yKHsgcGF0aCwgaGFuZGxlciB9KSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGhhbmRsZXIuc2hvdWxkLmJlLmEuRnVuY3Rpb25cbiAgICApO1xuICAgIF8uZXh0ZW5kKHRoaXMsIHsgcGF0aCwgaGFuZGxlciwgaWQ6IF8udW5pcXVlSWQocGF0aCkgfSk7XG5cdH1cblxuICBhZGRUbyhzdWJzY3JpcHRpb25zKSB7XG4gICAgXy5kZXYoKCkgPT4gc3Vic2NyaXB0aW9ucy5zaG91bGQuYmUuYW4uT2JqZWN0KTtcbiAgICBpZighc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdKSB7XG4gICAgICBzdWJzY3JpcHRpb25zW3RoaXMucGF0aF0gPSB7fTtcbiAgICB9XG4gICAgXy5kZXYoKCkgPT4gc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIHN1YnNjcmlwdGlvbnNbdGhpcy5wYXRoXVt0aGlzLmlkXS5zaG91bGQubm90LmJlLm9rXG4gICAgKTtcbiAgICBzdWJzY3JpcHRpb25zW3RoaXMucGF0aF1bdGhpcy5pZF0gPSB0aGlzO1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhzdWJzY3JpcHRpb25zW3RoaXMucGF0aF0pLmxlbmd0aCA9PT0gMTtcbiAgfVxuXG4gIHJlbW92ZUZyb20oc3Vic2NyaXB0aW9ucykge1xuICAgIF8uZGV2KCgpID0+IHN1YnNjcmlwdGlvbnMuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdLnNob3VsYmUuYmUuYW4uT2JqZWN0ICYmXG4gICAgICBzdWJzY3JpcHRpb25zW3RoaXMucGF0aF1bdGhpcy5pZF0uc2hvdWxkLmJlLmV4YWN0bHkodGhpcylcbiAgICApO1xuICAgIGRlbGV0ZSBzdWJzY3JpcHRpb25zW3RoaXMucGF0aF1bdGhpcy5pZF07XG4gICAgaWYoT2JqZWN0LmtleXMoc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSBzdWJzY3JpcHRpb25zW3RoaXMucGF0aF07XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdXBkYXRlKHZhbHVlKSB7XG4gICAgXy5kZXYoKCkgPT4gKHZhbHVlID09PSBudWxsIHx8IF8uaXNPYmplY3QodmFsdWUpKS5zaG91bGQuYmUub2spO1xuICAgIHRoaXMuaGFuZGxlci5jYWxsKG51bGwsIHZhbHVlKTtcbiAgfVxufVxuXG5fLmV4dGVuZChTdWJzY3JpcHRpb24ucHJvdG90eXBlLCB7XG5cdHBhdGg6IG51bGwsXG4gIGhhbmRsZXI6IG51bGwsXG5cdGlkOiBudWxsLFxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gU3Vic2NyaXB0aW9uO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9