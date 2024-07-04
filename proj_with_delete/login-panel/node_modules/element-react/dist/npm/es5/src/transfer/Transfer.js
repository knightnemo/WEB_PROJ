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

var _button = require('../button');

var _button2 = _interopRequireDefault(_button);

var _TransferPanel = require('./TransferPanel');

var _TransferPanel2 = _interopRequireDefault(_TransferPanel);

var _locale = require('../locale');

var _locale2 = _interopRequireDefault(_locale);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
  var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
  enterModule && enterModule(module);
})();

var Transfer = function (_Component) {
  (0, _inherits3.default)(Transfer, _Component);

  function Transfer(props) {
    (0, _classCallCheck3.default)(this, Transfer);

    var _this = (0, _possibleConstructorReturn3.default)(this, (Transfer.__proto__ || Object.getPrototypeOf(Transfer)).call(this, props));

    _this.onSourceCheckedChange = function (val) {
      _this.setState({ leftChecked: val });
    };

    _this.onTargetCheckedChange = function (val) {
      _this.setState({ rightChecked: val });
    };

    _this.addToLeft = function () {
      var value = _this.props.value;
      var rightChecked = _this.state.rightChecked;

      var currentValue = value.slice();
      rightChecked.forEach(function (item) {
        var index = currentValue.indexOf(item);
        if (index > -1) {
          currentValue.splice(index, 1);
        }
      });
      _this.setState({ rightChecked: [] }, function () {
        return _this.props.onChange(currentValue, 'left', rightChecked);
      });
    };

    _this.addToRight = function () {
      var value = _this.props.value;
      var leftChecked = _this.state.leftChecked;

      var currentValue = value.slice();
      leftChecked.forEach(function (item) {
        if (!value.includes(item)) {
          currentValue = currentValue.concat(item);
        }
      });
      _this.setState({ leftChecked: [] }, function () {
        return _this.props.onChange(currentValue, 'right', leftChecked);
      });
    };

    _this.state = {
      leftChecked: [],
      rightChecked: []
    };
    return _this;
  }

  (0, _createClass3.default)(Transfer, [{
    key: 'componentWillMount',
    value: function componentWillMount() {
      var _props = this.props,
          leftDefaultChecked = _props.leftDefaultChecked,
          rightDefaultChecked = _props.rightDefaultChecked;

      if (leftDefaultChecked.length) {
        this.setState({ leftChecked: leftDefaultChecked });
      }
      if (rightDefaultChecked.length) {
        this.setState({ rightChecked: rightDefaultChecked });
      }
    }
  }, {
    key: 'render',
    value: function render() {
      var _props2 = this.props,
          filterPlaceholder = _props2.filterPlaceholder,
          titles = _props2.titles,
          buttonTexts = _props2.buttonTexts,
          propsAlias = _props2.propsAlias,
          filterable = _props2.filterable,
          filterMethod = _props2.filterMethod,
          footerFormat = _props2.footerFormat,
          leftFooter = _props2.leftFooter,
          rightFooter = _props2.rightFooter,
          renderContent = _props2.renderContent;
      var _state = this.state,
          leftChecked = _state.leftChecked,
          rightChecked = _state.rightChecked;


      return _react2.default.createElement(
        'div',
        { className: 'el-transfer' },
        _react2.default.createElement(
          _TransferPanel2.default,
          {
            propsAlias: propsAlias,
            data: this.sourceData,
            title: titles[0] || _locale2.default.t('el.transfer.titles.0'),
            checked: leftChecked,
            filterable: filterable,
            filterMethod: filterMethod,
            footerFormat: footerFormat,
            renderContent: renderContent,
            placeholder: filterPlaceholder || _locale2.default.t('el.transfer.filterPlaceholder'),
            onChange: this.onSourceCheckedChange
          },
          leftFooter
        ),
        _react2.default.createElement(
          'div',
          { className: 'el-transfer__buttons' },
          _react2.default.createElement(
            _button2.default,
            {
              type: 'primary',
              size: 'small',
              onClick: this.addToLeft,
              disabled: rightChecked.length === 0
            },
            _react2.default.createElement('i', { className: 'el-icon-arrow-left' }),
            buttonTexts[0] !== undefined && _react2.default.createElement(
              'span',
              null,
              buttonTexts[0]
            )
          ),
          _react2.default.createElement(
            _button2.default,
            {
              type: 'primary',
              size: 'small',
              onClick: this.addToRight,
              disabled: leftChecked.length === 0
            },
            buttonTexts[1] !== undefined && _react2.default.createElement(
              'span',
              null,
              buttonTexts[1]
            ),
            _react2.default.createElement('i', { className: 'el-icon-arrow-right' })
          )
        ),
        _react2.default.createElement(
          _TransferPanel2.default,
          {
            propsAlias: propsAlias,
            data: this.targetData,
            title: titles[1] || _locale2.default.t('el.transfer.titles.1'),
            checked: rightChecked,
            filterable: filterable,
            filterMethod: filterMethod,
            footerFormat: footerFormat,
            renderContent: renderContent,
            placeholder: filterPlaceholder || _locale2.default.t('el.transfer.filterPlaceholder'),
            onChange: this.onTargetCheckedChange
          },
          rightFooter
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
  }, {
    key: 'sourceData',
    get: function get() {
      var _props3 = this.props,
          data = _props3.data,
          value = _props3.value,
          propsAlias = _props3.propsAlias;

      return data.filter(function (item) {
        return !value.includes(item[propsAlias.key]);
      });
    }
  }, {
    key: 'targetData',
    get: function get() {
      var _props4 = this.props,
          data = _props4.data,
          value = _props4.value,
          propsAlias = _props4.propsAlias;

      return data.filter(function (item) {
        return value.includes(item[propsAlias.key]);
      });
    }
  }]);
  return Transfer;
}(_libs.Component);

Transfer.propTypes = {
  data: _libs.PropTypes.array,
  titles: _libs.PropTypes.array,
  buttonTexts: _libs.PropTypes.array,
  filterPlaceholder: _libs.PropTypes.string,
  filterMethod: _libs.PropTypes.func,
  leftDefaultChecked: _libs.PropTypes.array,
  rightDefaultChecked: _libs.PropTypes.array,
  renderContent: _libs.PropTypes.func,
  value: _libs.PropTypes.array,
  footerFormat: _libs.PropTypes.object,
  filterable: _libs.PropTypes.bool,
  propsAlias: _libs.PropTypes.object,
  onChange: _libs.PropTypes.func,
  leftFooter: _libs.PropTypes.node,
  rightFooter: _libs.PropTypes.node
};
Transfer.defaultProps = {
  data: [],
  titles: [],
  buttonTexts: [],
  filterPlaceholder: '',
  leftDefaultChecked: [],
  rightDefaultChecked: [],
  value: [],
  footerFormat: {},
  propsAlias: {
    label: 'label',
    key: 'key',
    disabled: 'disabled'
  },
  onChange: function onChange() {}
};
var _default = Transfer;
exports.default = _default;
;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(Transfer, 'Transfer', 'src/transfer/Transfer.jsx');
  reactHotLoader.register(_default, 'default', 'src/transfer/Transfer.jsx');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();