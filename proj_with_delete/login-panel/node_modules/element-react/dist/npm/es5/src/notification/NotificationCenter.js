'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = NotificationCenter;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

var _Notification = require('./Notification');

var _Notification2 = _interopRequireDefault(_Notification);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
  var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
  enterModule && enterModule(module);
})();

var className = '.el-notification';

function NotificationCenter() {
  var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var type = arguments[1];

  var div = document.createElement('div');

  document.body.appendChild(div);

  if (typeof props === 'string' || _react2.default.isValidElement(props)) {
    props = {
      message: props
    };
  }

  if (type) {
    props.type = type;
  }

  if (!props.offset) {
    props.offset = 0;
  }

  var instances = document.querySelectorAll(className);

  var lastInstance = instances[instances.length - 1];

  props.top = (lastInstance ? parseInt(lastInstance.style.top) + lastInstance.offsetHeight : props.offset) + 16;

  var element = _react2.default.createElement(_Notification2.default, Object.assign({}, props, {
    willUnmount: function willUnmount(height, top) {
      setTimeout(function () {
        return document.body.removeChild(div);
      });
      requestAnimationFrame(function () {
        var instances = document.querySelectorAll(className);
        var len = instances.length;
        for (var i = 0; i < len; i++) {
          var _element = instances[i];
          var elementTop = parseInt(_element.style.top);
          if (elementTop > top) {
            _element.style.top = elementTop - height - 16 + 'px';
          }
        }
      });
    }
  }));

  _reactDom2.default.render(element, div);
}

/* eslint-disable */
['success', 'warning', 'info', 'error'].forEach(function (type) {
  NotificationCenter[type] = function () {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    return NotificationCenter(options, type);
  };
});
/* eslint-enable */

;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(className, 'className', 'src/notification/NotificationCenter.jsx');
  reactHotLoader.register(NotificationCenter, 'NotificationCenter', 'src/notification/NotificationCenter.jsx');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();