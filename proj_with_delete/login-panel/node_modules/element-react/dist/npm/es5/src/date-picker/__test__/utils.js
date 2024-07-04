'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.nativeEvent = undefined;
exports.mockRAf = mockRAf;

var _mockRaf = require('mock-raf');

var _mockRaf2 = _interopRequireDefault(_mockRaf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
    var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
    enterModule && enterModule(module);
})();

// import sinon from 'sinon'

function mockRAf() {
    var count = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 10;

    var mockRaf = (0, _mockRaf2.default)();
    // Stub out your `requestAnimationFrame` method
    global.requestAnimationFrame = mockRaf.raf;
    global.cancelAnimationFrame = function () {};
    // sinon.stub(global, 'requestAnimationFrame').callsFake(mockRaf.raf);
    // Take 10 `requestAnimationFrame` steps (your callback will fire 10 times)
    mockRaf.step({ count: count });
}

var nativeEvent = exports.nativeEvent = { nativeEvent: { stopImmediatePropagation: function stopImmediatePropagation() {} } };
;

(function () {
    var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

    if (!reactHotLoader) {
        return;
    }

    reactHotLoader.register(mockRAf, 'mockRAf', 'src/date-picker/__test__/utils.js');
    reactHotLoader.register(nativeEvent, 'nativeEvent', 'src/date-picker/__test__/utils.js');
})();

;

(function () {
    var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
    leaveModule && leaveModule(module);
})();