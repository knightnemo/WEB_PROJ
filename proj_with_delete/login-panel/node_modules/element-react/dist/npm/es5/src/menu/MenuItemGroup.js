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

var MenuItemGroup = function (_MixinComponent) {
  (0, _inherits3.default)(MenuItemGroup, _MixinComponent);

  function MenuItemGroup(props) {
    (0, _classCallCheck3.default)(this, MenuItemGroup);

    var _this = (0, _possibleConstructorReturn3.default)(this, (MenuItemGroup.__proto__ || Object.getPrototypeOf(MenuItemGroup)).call(this, props));

    _this.instanceType = 'MenuItemGroup';

    _this.state = {
      paddingLeft: 20
    };
    return _this;
  }

  (0, _createClass3.default)(MenuItemGroup, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      this.initPadding();
    }
  }, {
    key: 'initPadding',
    value: function initPadding() {
      var level = 0,
          parent = this.parent(),
          component = parent.instanceType;

      while (component !== 'Menu') {
        if (component === 'SubMenu') {
          level++;
        }

        parent = parent.parent();
        component = parent.instanceType;
      }

      this.setState({
        paddingLeft: this.state.paddingLeft + level * 10
      });
    }
  }, {
    key: 'render',
    value: function render() {
      return _react2.default.createElement(
        'li',
        { style: this.style(), className: this.className('el-menu-item-group') },
        _react2.default.createElement(
          'div',
          { className: 'el-menu-item-group__title', style: {
              paddingLeft: this.state.paddingLeft
            } },
          this.props.title
        ),
        _react2.default.createElement(
          'ul',
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
  return MenuItemGroup;
}(_MixinComponent3.default);

var _default = MenuItemGroup;
exports.default = _default;


MenuItemGroup.propTypes = {
  title: _libs.PropTypes.string.isRequired
};
;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(MenuItemGroup, 'MenuItemGroup', 'src/menu/MenuItemGroup.jsx');
  reactHotLoader.register(_default, 'default', 'src/menu/MenuItemGroup.jsx');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();