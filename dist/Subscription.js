"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = require("bluebird");var __DEV__ = (process.env.NODE_ENV !== "production");
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
          return subscriptions[_this.path].should.be.an.Object && subscriptions[_this.path].should.not.have.property(_this.id);
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
          return subscriptions.should.be.an.Object && subscriptions.should.have.property(_this2.path) && subscriptions[_this2.path].shoulbe.be.an.Object && subscriptions[_this2.path].should.have.property(_this2.id, _this2);
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
//# sourceMappingURL=data:application/json;base64,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QUNoQyxpQkFBTyxJQUFJLENBQUM7U0FDYjtBQUNELGVBQU8sS0FBSyxDQUFDO09BQ2Q7O0FBRUQsVUFBTTs7YUFBQSxVQUFDLEtBQUssRUFBRTtBQUNaLFNBQUMsQ0FBQyxHQUFHLENBQUM7aUJBQU0sQ0FBQyxLQUFLLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUU7U0FBQSxDQUFDLENBQUM7QUFDaEUsWUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO09BQ2hDOzs7O1NBckNHLFlBQVk7OztBQXdDbEIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFO0FBQ2hDLE1BQUksRUFBRSxJQUFJO0FBQ1QsU0FBTyxFQUFFLElBQUk7QUFDZCxJQUFFLEVBQUUsSUFBSSxFQUNSLENBQUMsQ0FBQzs7QUFFSCxNQUFNLENBQUMsT0FBTyxHQUFHLFlBQVksQ0FBQyIsImZpbGUiOiJTdWJzY3JpcHRpb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcblxuY2xhc3MgU3Vic2NyaXB0aW9uIHtcblx0Y29uc3RydWN0b3IoeyBwYXRoLCBoYW5kbGVyIH0pIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgXy5leHRlbmQodGhpcywgeyBwYXRoLCBoYW5kbGVyLCBpZDogXy51bmlxdWVJZChwYXRoKSB9KTtcblx0fVxuXG4gIGFkZFRvKHN1YnNjcmlwdGlvbnMpIHtcbiAgICBfLmRldigoKSA9PiBzdWJzY3JpcHRpb25zLnNob3VsZC5iZS5hbi5PYmplY3QpO1xuICAgIGlmKCFzdWJzY3JpcHRpb25zW3RoaXMucGF0aF0pIHtcbiAgICAgIHN1YnNjcmlwdGlvbnNbdGhpcy5wYXRoXSA9IHt9O1xuICAgIH1cbiAgICBfLmRldigoKSA9PiBzdWJzY3JpcHRpb25zW3RoaXMucGF0aF0uc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdLnNob3VsZC5ub3QuaGF2ZS5wcm9wZXJ0eSh0aGlzLmlkKVxuICAgICk7XG4gICAgc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdW3RoaXMuaWRdID0gdGhpcztcbiAgICByZXR1cm4gT2JqZWN0LmtleXMoc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdKS5sZW5ndGggPT09IDE7XG4gIH1cblxuICByZW1vdmVGcm9tKHN1YnNjcmlwdGlvbnMpIHtcbiAgICBfLmRldigoKSA9PiBzdWJzY3JpcHRpb25zLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIHN1YnNjcmlwdGlvbnMuc2hvdWxkLmhhdmUucHJvcGVydHkodGhpcy5wYXRoKSAmJlxuICAgICAgc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdLnNob3VsYmUuYmUuYW4uT2JqZWN0ICYmXG4gICAgICBzdWJzY3JpcHRpb25zW3RoaXMucGF0aF0uc2hvdWxkLmhhdmUucHJvcGVydHkodGhpcy5pZCwgdGhpcylcbiAgICApO1xuICAgIGRlbGV0ZSBzdWJzY3JpcHRpb25zW3RoaXMucGF0aF1bdGhpcy5pZF07XG4gICAgaWYoT2JqZWN0LmtleXMoc3Vic2NyaXB0aW9uc1t0aGlzLnBhdGhdKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSBzdWJzY3JpcHRpb25zW3RoaXMucGF0aF07XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdXBkYXRlKHZhbHVlKSB7XG4gICAgXy5kZXYoKCkgPT4gKHZhbHVlID09PSBudWxsIHx8IF8uaXNPYmplY3QodmFsdWUpKS5zaG91bGQuYmUub2spO1xuICAgIHRoaXMuaGFuZGxlci5jYWxsKG51bGwsIHZhbHVlKTtcbiAgfVxufVxuXG5fLmV4dGVuZChTdWJzY3JpcHRpb24ucHJvdG90eXBlLCB7XG5cdHBhdGg6IG51bGwsXG4gIGhhbmRsZXI6IG51bGwsXG5cdGlkOiBudWxsLFxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gU3Vic2NyaXB0aW9uO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9