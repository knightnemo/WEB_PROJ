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

var Button = function (_Component) {
  (0, _inherits3.default)(Button, _Component);

  function Button() {
    (0, _classCallCheck3.default)(this, Button);
    return (0, _possibleConstructorReturn3.default)(this, (Button.__proto__ || Object.getPrototypeOf(Button)).apply(this, arguments));
  }

  (0, _createClass3.default)(Button, [{
    key: 'onClick',
    value: function onClick(e) {
      if (!this.props.loading) {
        this.props.onClick && this.props.onClick(e);
      }
    }
  }, {
    key: 'render',
    value: function render() {
      return _react2.default.createElement(
        'button',
        { style: this.style(), className: this.className('el-button', this.props.type && 'el-button--' + this.props.type, this.props.size && 'el-button--' + this.props.size, {
            'is-disabled': this.props.disabled,
            'is-loading': this.props.loading,
            'is-plain': this.props.plain
          }), disabled: this.props.disabled, type: this.props.nativeType, onClick: this.onClick.bind(this) },
        this.props.loading && _react2.default.createElement('i', { className: 'el-icon-loading' }),
        this.props.icon && !this.props.loading && _react2.default.createElement('i', { className: 'el-icon-' + this.props.icon }),
        _react2.default.createElement(
          'span',
          null,
          this.props.children
        )
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
  return Button;
}(_libs.Component);

var _default = Button;
exports.default = _default;


Button.propTypes = {
  onClick: _libs.PropTypes.func,
  type: _libs.PropTypes.string,
  size: _libs.PropTypes.string,
  icon: _libs.PropTypes.string,
  nativeType: _libs.PropTypes.string,
  loading: _libs.PropTypes.bool,
  disabled: _libs.PropTypes.bool,
  plain: _libs.PropTypes.bool
};

Button.defaultProps = {
  type: 'default',
  nativeType: 'button',
  loading: false,
  disabled: false,
  plain: false
};
;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(Button, 'Button', 'src/button/Button.jsx');
  reactHotLoader.register(_default, 'default', 'src/button/Button.jsx');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();