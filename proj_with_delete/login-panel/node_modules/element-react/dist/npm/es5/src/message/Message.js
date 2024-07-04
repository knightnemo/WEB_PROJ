'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = Message;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

var _Toast = require('./Toast');

var _Toast2 = _interopRequireDefault(_Toast);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
  var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
  enterModule && enterModule(module);
})();

function Message() {
  var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var type = arguments[1];

  var div = document.createElement('div');
  var messageBox = document.getElementsByClassName('el-message-content')[0];
  if (messageBox) {
    messageBox.appendChild(div);
    document.body.appendChild(messageBox);
  } else {
    var _messageBox = document.createElement('div');
    _messageBox.className = "el-message-content";
    _messageBox.appendChild(div);
    document.body.appendChild(_messageBox);
  }

  if (typeof props === 'string' || _react2.default.isValidElement(props)) {
    props = {
      message: props
    };
  }

  if (type) {
    props.type = type;
  }

  var component = _react2.default.createElement(_Toast2.default, Object.assign(props, {
    willUnmount: function willUnmount() {
      var messageBox = document.getElementsByClassName('el-message-content')[0];
      _reactDom2.default.unmountComponentAtNode(div);
      messageBox.removeChild(div);

      if (props.onClose instanceof Function) {
        props.onClose();
      }
    }
  }));

  _reactDom2.default.render(component, div);
}

/* eslint-disable */
['success', 'warning', 'info', 'error'].forEach(function (type) {
  Message[type] = function () {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    return Message(options, type);
  };
});
/* eslint-enable */

;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(Message, 'Message', 'src/message/Message.jsx');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();