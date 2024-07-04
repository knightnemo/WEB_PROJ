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

var _MixinComponent2 = require('./MixinComponent');

var _MixinComponent3 = _interopRequireDefault(_MixinComponent2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
  var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
  enterModule && enterModule(module);
})();

var MenuItem = function (_MixinComponent) {
  (0, _inherits3.default)(MenuItem, _MixinComponent);

  function MenuItem(props) {
    (0, _classCallCheck3.default)(this, MenuItem);

    var _this = (0, _possibleConstructorReturn3.default)(this, (MenuItem.__proto__ || Object.getPrototypeOf(MenuItem)).call(this, props));

    _this.instanceType = 'MenuItem';
    return _this;
  }

  (0, _createClass3.default)(MenuItem, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      this.rootMenu().state.menuItems[this.props.index] = this;
    }
  }, {
    key: 'handleClick',
    value: function handleClick() {
      this.rootMenu().handleSelect(this.props.index, this.indexPath(), this);
    }
  }, {
    key: 'active',
    value: function active() {
      return this.props.index === this.rootMenu().state.activeIndex;
    }
  }, {
    key: 'render',
    value: function render() {
      return _react2.default.createElement(
        'li',
        {
          style: this.style(),
          className: this.className("el-menu-item", {
            'is-active': this.active(),
            'is-disabled': this.props.disabled
          }),
          onClick: this.handleClick.bind(this)
        },
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
  return MenuItem;
}(_MixinComponent3.default);

var _default = MenuItem;
exports.default = _default;


MenuItem.propTypes = {
  index: _libs.PropTypes.string.isRequired,
  disabled: _libs.PropTypes.bool
};
;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(MenuItem, 'MenuItem', 'src/menu/MenuItem.jsx');
  reactHotLoader.register(_default, 'default', 'src/menu/MenuItem.jsx');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();