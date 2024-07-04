"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._ProgressEvent = exports.RawFile = undefined;

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require("babel-runtime/helpers/possibleConstructorReturn");

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require("babel-runtime/helpers/inherits");

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
  var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
  enterModule && enterModule(module);
})();

var RawFile = exports.RawFile = function (_File2) {
  (0, _inherits3.default)(RawFile, _File2);

  function RawFile() {
    (0, _classCallCheck3.default)(this, RawFile);
    return (0, _possibleConstructorReturn3.default)(this, (RawFile.__proto__ || Object.getPrototypeOf(RawFile)).apply(this, arguments));
  }

  (0, _createClass3.default)(RawFile, [{
    key: "__reactstandin__regenerateByEval",
    // @ts-ignore
    value: function __reactstandin__regenerateByEval(key, code) {
      // @ts-ignore
      this[key] = eval(code);
    }
  }]);
  return RawFile;
}(File);

// 自定义file类型


var _ProgressEvent = exports._ProgressEvent = function (_ProgressEvent2) {
  (0, _inherits3.default)(_ProgressEvent, _ProgressEvent2);

  function _ProgressEvent() {
    (0, _classCallCheck3.default)(this, _ProgressEvent);
    return (0, _possibleConstructorReturn3.default)(this, (_ProgressEvent.__proto__ || Object.getPrototypeOf(_ProgressEvent)).apply(this, arguments));
  }

  (0, _createClass3.default)(_ProgressEvent, [{
    key: "__reactstandin__regenerateByEval",
    // @ts-ignore
    value: function __reactstandin__regenerateByEval(key, code) {
      // @ts-ignore
      this[key] = eval(code);
    }
  }]);
  return _ProgressEvent;
}(ProgressEvent);

;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(RawFile, "RawFile", "src/upload/Types.js");
  reactHotLoader.register(_ProgressEvent, "_ProgressEvent", "src/upload/Types.js");
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();