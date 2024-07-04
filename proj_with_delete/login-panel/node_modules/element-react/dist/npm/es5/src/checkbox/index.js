'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _CheckBox = require('./CheckBox');

var _CheckBox2 = _interopRequireDefault(_CheckBox);

var _CheckBoxGroup = require('./CheckBoxGroup');

var _CheckBoxGroup2 = _interopRequireDefault(_CheckBoxGroup);

var _CheckBoxButton = require('./CheckBoxButton');

var _CheckBoxButton2 = _interopRequireDefault(_CheckBoxButton);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
  var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
  enterModule && enterModule(module);
})();

_CheckBox2.default.Group = _CheckBoxGroup2.default;
_CheckBox2.default.Button = _CheckBoxButton2.default;

var _default = _CheckBox2.default;
exports.default = _default;
;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(_default, 'default', 'src/checkbox/index.js');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();