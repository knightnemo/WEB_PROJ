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

var Card = function (_Component) {
  (0, _inherits3.default)(Card, _Component);

  function Card() {
    (0, _classCallCheck3.default)(this, Card);
    return (0, _possibleConstructorReturn3.default)(this, (Card.__proto__ || Object.getPrototypeOf(Card)).apply(this, arguments));
  }

  (0, _createClass3.default)(Card, [{
    key: 'render',
    value: function render() {
      var _props = this.props,
          header = _props.header,
          bodyStyle = _props.bodyStyle,
          children = _props.children;

      return _react2.default.createElement(
        'div',
        { style: this.style(), className: this.className('el-card') },
        header && _react2.default.createElement(
          'div',
          { className: 'el-card__header' },
          header
        ),
        _react2.default.createElement(
          'div',
          { className: 'el-card__body', style: bodyStyle },
          children
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
  return Card;
}(_libs.Component);

Card.defaultProps = {
  bodyStyle: {
    padding: '20px'
  }
};
var _default = Card;
exports.default = _default;


Card.propTypes = {
  header: _libs.PropTypes.node,
  bodyStyle: _libs.PropTypes.object
};
;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(Card, 'Card', 'src/card/Card.jsx');
  reactHotLoader.register(_default, 'default', 'src/card/Card.jsx');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();