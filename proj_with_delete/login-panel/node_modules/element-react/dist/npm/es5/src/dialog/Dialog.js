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

var _utils = require('../table/utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
  var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
  enterModule && enterModule(module);
})();

var Dialog = function (_Component) {
  (0, _inherits3.default)(Dialog, _Component);

  function Dialog(props) {
    (0, _classCallCheck3.default)(this, Dialog);

    var _this = (0, _possibleConstructorReturn3.default)(this, (Dialog.__proto__ || Object.getPrototypeOf(Dialog)).call(this, props));

    _this.wrap = _react2.default.createRef();
    _this.state = {
      bodyOverflow: ''
    };
    return _this;
  }

  (0, _createClass3.default)(Dialog, [{
    key: 'componentWillReceiveProps',
    value: function componentWillReceiveProps(nextProps) {
      var bodyOverflow = this.state.bodyOverflow;
      var _props = this.props,
          lockScroll = _props.lockScroll,
          modal = _props.modal;

      if (this.willOpen(this.props, nextProps)) {
        (0, _utils.cleanScrollBar)();
        if (lockScroll && document.body && document.body.style) {
          if (!bodyOverflow) {
            this.setState({
              bodyOverflow: document.body.style.overflow
            });
          }
          document.body.style.overflow = 'hidden';
        }
      }

      if (this.willClose(this.props, nextProps) && lockScroll) {
        if (modal && bodyOverflow !== 'hidden' && document.body && document.body.style) {
          document.body.style.overflow = bodyOverflow;
        }
      }
    }
  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate(prevProps) {
      if (this.willOpen(prevProps, this.props)) {
        this.wrap.current.focus();
      }
    }
  }, {
    key: 'componentWillUnmount',
    value: function componentWillUnmount() {
      var lockScroll = this.props.lockScroll;

      if (lockScroll && document.body && document.body.style) {
        document.body.style.removeProperty('overflow');
      }
    }
  }, {
    key: 'onKeyDown',
    value: function onKeyDown(e) {
      var closeOnPressEscape = this.props.closeOnPressEscape;

      if (closeOnPressEscape && e.keyCode === 27) {
        this.close(e);
      }
    }
  }, {
    key: 'handleWrapperClick',
    value: function handleWrapperClick(e) {
      var closeOnClickModal = this.props.closeOnClickModal;

      if (e.target instanceof HTMLDivElement) {
        if (closeOnClickModal && e.target === e.currentTarget) {
          this.close(e);
        }
      }
    }
  }, {
    key: 'close',
    value: function close(e) {
      this.props.onCancel(e);
    }
  }, {
    key: 'willOpen',
    value: function willOpen(prevProps, nextProps) {
      return !prevProps.visible && nextProps.visible;
    }
  }, {
    key: 'willClose',
    value: function willClose(prevProps, nextProps) {
      return prevProps.visible && !nextProps.visible;
    }
  }, {
    key: 'render',
    value: function render() {
      var _this2 = this;

      var _props2 = this.props,
          visible = _props2.visible,
          title = _props2.title,
          size = _props2.size,
          top = _props2.top,
          modal = _props2.modal,
          customClass = _props2.customClass,
          showClose = _props2.showClose,
          children = _props2.children;


      return _react2.default.createElement(
        'div',
        null,
        _react2.default.createElement(
          _libs.Transition,
          { name: 'dialog-fade' },
          _react2.default.createElement(
            _libs.View,
            { show: visible },
            _react2.default.createElement(
              'div',
              {
                ref: this.wrap,
                style: { zIndex: 1013 },
                className: this.classNames('el-dialog__wrapper'),
                onClick: function onClick(e) {
                  return _this2.handleWrapperClick(e);
                },
                onKeyDown: function onKeyDown(e) {
                  return _this2.onKeyDown(e);
                }
              },
              _react2.default.createElement(
                'div',
                {
                  ref: 'dialog',
                  style: this.style(size === 'full' ? {} : { 'top': top }),
                  className: this.className("el-dialog", 'el-dialog--' + size, customClass)
                },
                _react2.default.createElement(
                  'div',
                  { className: 'el-dialog__header' },
                  _react2.default.createElement(
                    'span',
                    { className: 'el-dialog__title' },
                    title
                  ),
                  showClose && _react2.default.createElement(
                    'button',
                    { type: 'button', className: 'el-dialog__headerbtn', onClick: function onClick(e) {
                        return _this2.close(e);
                      } },
                    _react2.default.createElement('i', { className: 'el-dialog__close el-icon el-icon-close' })
                  )
                ),
                children
              )
            )
          )
        ),
        modal && _react2.default.createElement(
          _libs.View,
          { show: visible },
          _react2.default.createElement('div', { className: 'v-modal', style: { zIndex: 1012 } })
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
  return Dialog;
}(_libs.Component);

Dialog.defaultProps = {
  visible: false,
  title: '',
  size: 'small',
  top: '15%',
  modal: true,
  lockScroll: true,
  closeOnClickModal: true,
  closeOnPressEscape: true,
  showClose: true
};
var _default = Dialog;
exports.default = _default;


Dialog.propTypes = {
  // 控制对话框是否可见
  visible: _libs.PropTypes.bool.isRequired,
  // 标题
  title: _libs.PropTypes.string,
  // 大小 (tiny/small/large/full)
  size: _libs.PropTypes.string,
  // top 值（仅在 size 不为 full 时有效）
  top: _libs.PropTypes.string,
  // 控制遮罩层展示
  modal: _libs.PropTypes.bool,
  // Dialog 的自定义类名
  customClass: _libs.PropTypes.string,
  // 是否在 Dialog 出现时将 body 滚动锁定
  lockScroll: _libs.PropTypes.bool,
  // 是否可以通过点击 modal 关闭 Dialog
  closeOnClickModal: _libs.PropTypes.bool,
  // 是否可以通过按下 ESC 关闭 Dialog
  closeOnPressEscape: _libs.PropTypes.bool,
  // 点击遮罩层或右上角叉或取消按钮的回调
  onCancel: _libs.PropTypes.func.isRequired,
  showClose: _libs.PropTypes.bool
};
;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(Dialog, 'Dialog', 'src/dialog/Dialog.jsx');
  reactHotLoader.register(_default, 'default', 'src/dialog/Dialog.jsx');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();