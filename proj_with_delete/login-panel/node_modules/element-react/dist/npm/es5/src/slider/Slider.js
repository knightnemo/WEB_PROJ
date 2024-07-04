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

var _inputNumber = require('../input-number');

var _inputNumber2 = _interopRequireDefault(_inputNumber);

var _Button = require('./Button');

var _Button2 = _interopRequireDefault(_Button);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
  var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
  enterModule && enterModule(module);
})();

var Slider = function (_Component) {
  (0, _inherits3.default)(Slider, _Component);

  function Slider(props) {
    (0, _classCallCheck3.default)(this, Slider);

    var _this = (0, _possibleConstructorReturn3.default)(this, (Slider.__proto__ || Object.getPrototypeOf(Slider)).call(this, props));

    _this.slider = _react2.default.createRef();
    _this.button1 = _react2.default.createRef();
    _this.button2 = _react2.default.createRef();
    _this.state = {
      firstValue: 0,
      secondValue: 0,
      oldValue: 0,
      precision: 0,
      inputValue: 0,
      dragging: false
    };
    return _this;
  }

  (0, _createClass3.default)(Slider, [{
    key: 'getChildContext',
    value: function getChildContext() {
      return {
        component: this
      };
    }
  }, {
    key: 'componentWillMount',
    value: function componentWillMount() {
      var _props = this.props,
          range = _props.range,
          value = _props.value,
          min = _props.min,
          max = _props.max,
          step = _props.step;
      var _state = this.state,
          firstValue = _state.firstValue,
          secondValue = _state.secondValue,
          oldValue = _state.oldValue,
          inputValue = _state.inputValue,
          precision = _state.precision;


      if (range) {
        if (Array.isArray(value)) {
          firstValue = Math.max(min, value[0]);
          secondValue = Math.min(max, value[1]);
        } else {
          firstValue = min;
          secondValue = max;
        }

        oldValue = [firstValue, secondValue];
      } else {
        firstValue = this.initValue;
        oldValue = firstValue;
      }

      var precisions = [min, max, step].map(function (item) {
        var decimal = ('' + item).split('.')[1];
        return decimal ? decimal.length : 0;
      });

      precision = Math.max.apply(null, precisions);
      inputValue = inputValue || firstValue;

      this.setState({ firstValue: firstValue, secondValue: secondValue, oldValue: oldValue, inputValue: inputValue, precision: precision });
    }
  }, {
    key: 'componentWillUpdate',
    value: function componentWillUpdate(props) {
      var _props2 = this.props,
          min = _props2.min,
          max = _props2.max,
          value = _props2.value,
          range = _props2.range;
      var dragging = this.state.dragging;

      if (props.min != min || props.max != max) {
        this.setValues();
      }

      if (props.value != value) {
        var _oldValue = this.state.oldValue;


        if (dragging || Array.isArray(value) && Array.isArray(props.value) && Array.isArray(_oldValue) && value.every(function (item, index) {
          return item === _oldValue[index];
        })) {
          return;
        } else if (!range && typeof props.value === 'number' && !isNaN(props.value)) {
          this.setState({ firstValue: props.value });
        }
        this.setValues();
      }
    }
  }, {
    key: 'valueChanged',
    value: function valueChanged() {
      var range = this.props.range;
      var _state2 = this.state,
          firstValue = _state2.firstValue,
          oldValue = _state2.oldValue;

      if (range && Array.isArray(oldValue)) {
        return ![this.minValue(), this.maxValue()].every(function (item, index) {
          return item === oldValue[index];
        });
      } else {
        return firstValue !== oldValue;
      }
    }
  }, {
    key: 'setValues',
    value: function setValues() {
      var _this2 = this;

      var _props3 = this.props,
          range = _props3.range,
          value = _props3.value,
          min = _props3.min,
          max = _props3.max;
      var _state3 = this.state,
          firstValue = _state3.firstValue,
          secondValue = _state3.secondValue,
          oldValue = _state3.oldValue,
          inputValue = _state3.inputValue;


      if (range && Array.isArray(value)) {
        if (value[1] < min) {
          inputValue = [min, min];
        } else if (value[0] > max) {
          inputValue = [max, max];
        } else if (value[0] < min) {
          inputValue = [min, value[1]];
        } else if (value[1] > max) {
          inputValue = [value[0], max];
        } else {
          firstValue = value[0];
          secondValue = value[1];

          if (this.valueChanged()) {
            this.onValueChanged([this.minValue(), this.maxValue()]);

            oldValue = value.slice();
          }
        }
      } else if (!range && typeof value === 'number' && !isNaN(value)) {
        if (this.initValue < min) {
          inputValue = min;
        } else if (this.initValue > max) {
          inputValue = max;
        } else {
          inputValue = firstValue;

          this.setState({ firstValue: firstValue }, function () {
            if (_this2.valueChanged()) {
              _this2.onValueChanged(firstValue);
              _this2.setState({ oldValue: firstValue });
            }
          });
        }
      }

      this.setState({ firstValue: firstValue, secondValue: secondValue, inputValue: inputValue });
    }
  }, {
    key: 'setPosition',
    value: function setPosition(percent) {
      var _props4 = this.props,
          range = _props4.range,
          min = _props4.min,
          max = _props4.max;
      var _state4 = this.state,
          firstValue = _state4.firstValue,
          secondValue = _state4.secondValue;


      var targetValue = min + percent * (max - min) / 100;

      if (!range) {
        this.button1.current.setPosition(percent);
        return;
      }

      var button = void 0;

      if (Math.abs(this.minValue() - targetValue) < Math.abs(this.maxValue() - targetValue)) {
        button = firstValue < secondValue ? 'button1' : 'button2';
      } else {
        button = firstValue > secondValue ? 'button1' : 'button2';
      }

      this[button].current.setPosition(percent);
    }
  }, {
    key: 'onSliderClick',
    value: function onSliderClick(event) {
      var _props5 = this.props,
          disabled = _props5.disabled,
          dragging = _props5.dragging,
          vertical = _props5.vertical;

      if (disabled || dragging) return;

      if (vertical) {
        var sliderOffsetBottom = this.slider.current.getBoundingClientRect().bottom;
        this.setPosition((sliderOffsetBottom - event.clientY) / this.sliderSize() * 100);
      } else {
        var sliderOffsetLeft = this.slider.current.getBoundingClientRect().left;
        this.setPosition((event.clientX - sliderOffsetLeft) / this.sliderSize() * 100);
      }

      this.setValues();
    }

    /* Watched Methods */

  }, {
    key: 'onValueChanged',
    value: function onValueChanged(val) {
      var onChange = this.props.onChange;

      if (onChange) onChange(val);
    }
  }, {
    key: 'onInputValueChanged',
    value: function onInputValueChanged(e) {
      var _this3 = this;

      this.setState({
        inputValue: e || 0,
        firstValue: e || 0
      }, function () {
        _this3.setValues();
      });
    }
  }, {
    key: 'onFirstValueChange',
    value: function onFirstValueChange(value) {
      var _this4 = this;

      var firstValue = this.state.firstValue;

      if (firstValue !== value) {
        this.setState({ firstValue: value }, function () {
          return _this4.setValues();
        });
      }
    }
  }, {
    key: 'onSecondValueChange',
    value: function onSecondValueChange(value) {
      var _this5 = this;

      var secondValue = this.state.secondValue;

      if (secondValue !== value) {
        this.setState({ secondValue: value }, function () {
          return _this5.setValues();
        });
      }
    }

    /* Computed Methods */

  }, {
    key: 'sliderSize',
    value: function sliderSize() {
      var vertical = this.props.vertical;

      return parseInt(vertical ? this.slider.current.offsetHeight : this.slider.current.offsetWidth, 10);
    }
  }, {
    key: 'stops',
    value: function stops() {
      var _this6 = this;

      var _props6 = this.props,
          range = _props6.range,
          min = _props6.min,
          max = _props6.max,
          step = _props6.step;
      var firstValue = this.state.firstValue;


      var stopCount = (max - min) / step;
      var stepWidth = 100 * step / (max - min);
      var result = [];

      for (var i = 1; i < stopCount; i++) {
        result.push(i * stepWidth);
      }

      if (range) {
        return result.filter(function (step) {
          return step < 100 * (_this6.minValue() - min) / (max - min) || step > 100 * (_this6.maxValue() - min) / (max - min);
        });
      } else {
        return result.filter(function (step) {
          return step > 100 * (firstValue - min) / (max - min);
        });
      }
    }
  }, {
    key: 'minValue',
    value: function minValue() {
      var _state5 = this.state,
          firstValue = _state5.firstValue,
          secondValue = _state5.secondValue;

      return Math.min(firstValue, secondValue);
    }
  }, {
    key: 'maxValue',
    value: function maxValue() {
      var _state6 = this.state,
          firstValue = _state6.firstValue,
          secondValue = _state6.secondValue;

      return Math.max(firstValue, secondValue);
    }
  }, {
    key: 'runwayStyle',
    value: function runwayStyle() {
      var _props7 = this.props,
          vertical = _props7.vertical,
          height = _props7.height;

      return vertical ? { height: height } : {};
    }
  }, {
    key: 'barStyle',
    value: function barStyle() {
      var vertical = this.props.vertical;

      return vertical ? {
        height: this.barSize(),
        bottom: this.barStart()
      } : {
        width: this.barSize(),
        left: this.barStart()
      };
    }
  }, {
    key: 'barSize',
    value: function barSize() {
      var firstValue = this.state.firstValue;
      var _props8 = this.props,
          range = _props8.range,
          max = _props8.max,
          min = _props8.min;

      return range ? 100 * (this.maxValue() - this.minValue()) / (max - min) + '%' : 100 * (firstValue - min) / (max - min) + '%';
    }
  }, {
    key: 'barStart',
    value: function barStart() {
      var _props9 = this.props,
          range = _props9.range,
          max = _props9.max,
          min = _props9.min;

      return range ? 100 * (this.minValue() - min) / (max - min) + '%' : '0%';
    }
  }, {
    key: 'render',
    value: function render() {
      var _props10 = this.props,
          vertical = _props10.vertical,
          showInput = _props10.showInput,
          showStops = _props10.showStops,
          showInputControls = _props10.showInputControls,
          range = _props10.range,
          step = _props10.step,
          disabled = _props10.disabled,
          min = _props10.min,
          max = _props10.max;
      var _state7 = this.state,
          inputValue = _state7.inputValue,
          firstValue = _state7.firstValue,
          secondValue = _state7.secondValue;


      return _react2.default.createElement(
        'div',
        { className: this.className('el-slider', {
            'is-vertical': vertical,
            'el-slider--with-input': showInput
          }) },
        showInput && !range && _react2.default.createElement(_inputNumber2.default, {
          ref: 'input',
          className: 'el-slider__input',
          defaultValue: inputValue,
          value: firstValue,
          step: step,
          disabled: disabled,
          controls: showInputControls,
          min: min,
          max: max,
          size: 'small',
          onChange: this.onInputValueChanged.bind(this)
        }),
        _react2.default.createElement(
          'div',
          {
            ref: this.slider,
            style: this.runwayStyle(),
            className: this.classNames('el-slider__runway', {
              'show-input': showInput,
              'disabled': disabled
            }),
            onClick: this.onSliderClick.bind(this)
          },
          _react2.default.createElement('div', {
            className: 'el-slider__bar',
            style: this.barStyle() }),
          _react2.default.createElement(_Button2.default, {
            ref: this.button1,
            vertical: vertical, value: firstValue,
            onChange: this.onFirstValueChange.bind(this)
          }),
          range && _react2.default.createElement(_Button2.default, {
            ref: this.button2,
            vertical: vertical, value: secondValue,
            onChange: this.onSecondValueChange.bind(this)
          }),
          showStops && this.stops().map(function (item, index) {
            return _react2.default.createElement('div', {
              key: index,
              className: 'el-slider__stop',
              style: vertical ? { 'bottom': item + '%' } : { 'left': item + '%' }
            });
          })
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
    key: 'initValue',
    get: function get() {
      var _props11 = this.props,
          value = _props11.value,
          min = _props11.min,
          max = _props11.max;

      var initValue = value;
      if (typeof value !== 'number' || isNaN(value)) {
        initValue = min;
      } else {
        initValue = Math.min(max, Math.max(min, value));
      }
      return initValue;
    }
  }]);
  return Slider;
}(_libs.Component);

var _default = Slider;
exports.default = _default;


Slider.childContextTypes = {
  component: _libs.PropTypes.any
};

Slider.propTypes = {
  min: _libs.PropTypes.oneOfType([_libs.PropTypes.number, _libs.PropTypes.string]),
  max: _libs.PropTypes.oneOfType([_libs.PropTypes.number, _libs.PropTypes.string]),
  step: _libs.PropTypes.oneOfType([_libs.PropTypes.number, _libs.PropTypes.string]),
  value: _libs.PropTypes.oneOfType([_libs.PropTypes.number, _libs.PropTypes.arrayOf(_libs.PropTypes.number)]),
  showInput: _libs.PropTypes.bool,
  showInputControls: _libs.PropTypes.bool,
  showTooltip: _libs.PropTypes.bool,
  showStops: _libs.PropTypes.bool,
  disabled: _libs.PropTypes.bool,
  range: _libs.PropTypes.bool,
  vertical: _libs.PropTypes.bool,
  height: _libs.PropTypes.string,
  formatTooltip: _libs.PropTypes.func,
  onChange: _libs.PropTypes.func
};

Slider.defaultProps = {
  showTooltip: true,
  showInputControls: true,
  min: 0,
  max: 100,
  step: 1,
  value: 0
};
;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(Slider, 'Slider', 'src/slider/Slider.jsx');
  reactHotLoader.register(_default, 'default', 'src/slider/Slider.jsx');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();