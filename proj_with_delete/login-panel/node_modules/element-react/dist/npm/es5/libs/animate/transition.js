'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactTransitionGroup = require('react-transition-group');

var _ = require('../');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
  var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
  enterModule && enterModule(module);
})();

var noneFun = function noneFun() {
  return undefined;
};

var Transition = function (_Component) {
  (0, _inherits3.default)(Transition, _Component);

  function Transition() {
    (0, _classCallCheck3.default)(this, Transition);
    return (0, _possibleConstructorReturn3.default)(this, (Transition.__proto__ || Object.getPrototypeOf(Transition)).apply(this, arguments));
  }

  (0, _createClass3.default)(Transition, [{
    key: 'render',
    value: function render() {
      var _this2 = this;

      var _props = this.props,
          inProp = _props.in,
          _onEnter = _props.onEnter,
          _onEntering = _props.onEntering,
          _onEntered = _props.onEntered,
          _onExit = _props.onExit,
          _onExiting = _props.onExiting,
          _onExited = _props.onExited,
          _addEndListener = _props.addEndListener,
          unmountOnExit = _props.unmountOnExit,
          appear = _props.appear,
          duration = _props.duration,
          mountOnEnter = _props.mountOnEnter,
          transitionClass = _props.transitionClass;

      return _react2.default.createElement(
        _reactTransitionGroup.Transition,
        {
          onEnter: function onEnter() {
            return _onEnter();
          },
          onEntering: function onEntering() {
            return _onEntering();
          },
          onEntered: function onEntered() {
            return _onEntered();
          },
          onExit: function onExit() {
            return _onExit();
          },
          onExiting: function onExiting() {
            return _onExiting();
          },
          onExited: function onExited() {
            return _onExited();
          },
          addEndListener: function addEndListener() {
            return _addEndListener();
          },
          'in': inProp,
          mountOnEnter: mountOnEnter,
          unmountOnExit: unmountOnExit,
          appear: appear,
          timeout: duration
        },
        function (state) {
          return _react2.default.createElement(
            _.View,
            {
              className: transitionClass[state]
            },
            _this2.props.children
          );
        }
      );
    }
  }, {
    key: '__reactstandin__regenerateByEval',
    // @ts-ignore
    value: function __reactstandin__regenerateByEval(key, code) {
      // @ts-ignore
      this[key] = eval(code);
    }
  }]);
  return Transition;
}(_react.Component);

Transition.defaultProps = {
  onEnter: noneFun,
  onEntering: noneFun,
  onEntered: noneFun,
  onExit: noneFun,
  onExiting: noneFun,
  onExited: noneFun,
  addEndListener: noneFun,
  mountOnEnter: false,
  unmountOnExit: false,
  appear: true,
  duration: 0
};

var _default = Transition;
exports.default = _default;
;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(noneFun, 'noneFun', 'libs/animate/transition.jsx');
  reactHotLoader.register(Transition, 'Transition', 'libs/animate/transition.jsx');
  reactHotLoader.register(_default, 'default', 'libs/animate/transition.jsx');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();