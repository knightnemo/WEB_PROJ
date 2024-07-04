'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MethodImplementationRequiredError = exports.ExtendableError = undefined;

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
  var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
  enterModule && enterModule(module);
})();

//taken from : http://stackoverflow.com/questions/31089801/extending-error-in-javascript-with-es6-syntax
var ExtendableError = exports.ExtendableError = function (_Error) {
  (0, _inherits3.default)(ExtendableError, _Error);

  function ExtendableError(message) {
    (0, _classCallCheck3.default)(this, ExtendableError);

    var _this = (0, _possibleConstructorReturn3.default)(this, (ExtendableError.__proto__ || Object.getPrototypeOf(ExtendableError)).call(this, message));

    _this.name = _this.constructor.name;
    _this.message = message;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(_this, _this.constructor);
    } else {
      _this.stack = new Error(message).stack;
    }
    return _this;
  }

  (0, _createClass3.default)(ExtendableError, [{
    key: '__reactstandin__regenerateByEval',
    // @ts-ignore
    value: function __reactstandin__regenerateByEval(key, code) {
      // @ts-ignore
      this[key] = eval(code);
    }
  }]);
  return ExtendableError;
}(Error);

var MethodImplementationRequiredError = exports.MethodImplementationRequiredError = function (_ExtendableError) {
  (0, _inherits3.default)(MethodImplementationRequiredError, _ExtendableError);

  function MethodImplementationRequiredError(msg) {
    (0, _classCallCheck3.default)(this, MethodImplementationRequiredError);
    return (0, _possibleConstructorReturn3.default)(this, (MethodImplementationRequiredError.__proto__ || Object.getPrototypeOf(MethodImplementationRequiredError)).call(this, msg));
  }

  (0, _createClass3.default)(MethodImplementationRequiredError, [{
    key: '__reactstandin__regenerateByEval',
    // @ts-ignore
    value: function __reactstandin__regenerateByEval(key, code) {
      // @ts-ignore
      this[key] = eval(code);
    }
  }]);
  return MethodImplementationRequiredError;
}(ExtendableError);

;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(ExtendableError, 'ExtendableError', 'libs/utils/errors.js');
  reactHotLoader.register(MethodImplementationRequiredError, 'MethodImplementationRequiredError', 'libs/utils/errors.js');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();