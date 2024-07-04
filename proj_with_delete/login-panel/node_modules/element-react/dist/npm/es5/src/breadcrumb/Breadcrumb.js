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

var _libs = require('../../libs');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
  var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
  enterModule && enterModule(module);
})();

var Breadcrumb = function (_Component) {
  (0, _inherits3.default)(Breadcrumb, _Component);

  function Breadcrumb() {
    (0, _classCallCheck3.default)(this, Breadcrumb);
    return (0, _possibleConstructorReturn3.default)(this, (Breadcrumb.__proto__ || Object.getPrototypeOf(Breadcrumb)).apply(this, arguments));
  }

  (0, _createClass3.default)(Breadcrumb, [{
    key: 'getChildContext',
    value: function getChildContext() {
      return {
        separator: this.props.separator
      };
    }
  }, {
    key: 'render',
    value: function render() {
      return _react2.default.createElement(
        'div',
        { style: this.style(), className: this.className('el-breadcrumb') },
        this.props.children
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
  return Breadcrumb;
}(_libs.Component);

var _default = Breadcrumb;
exports.default = _default;


Breadcrumb.childContextTypes = {
  separator: _libs.PropTypes.string
};

Breadcrumb.propTypes = {
  separator: _libs.PropTypes.string
};

Breadcrumb.defaultProps = {
  separator: '/'
};
;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(Breadcrumb, 'Breadcrumb', 'src/breadcrumb/Breadcrumb.jsx');
  reactHotLoader.register(_default, 'default', 'src/breadcrumb/Breadcrumb.jsx');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();