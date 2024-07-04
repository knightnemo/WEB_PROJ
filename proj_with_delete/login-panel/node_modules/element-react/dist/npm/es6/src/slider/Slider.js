import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _createClass from 'babel-runtime/helpers/createClass';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import React from 'react';
import { Component, PropTypes } from '../../libs';

import InputNumber from '../input-number';
import SliderButton from './Button';

var Slider = function (_Component) {
  _inherits(Slider, _Component);

  function Slider(props) {
    _classCallCheck(this, Slider);

    var _this = _possibleConstructorReturn(this, _Component.call(this, props));

    _this.slider = React.createRef();
    _this.button1 = React.createRef();
    _this.button2 = React.createRef();
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

  Slider.prototype.getChildContext = function getChildContext() {
    return {
      component: this
    };
  };

  Slider.prototype.componentWillMount = function componentWillMount() {
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
  };

  Slider.prototype.componentWillUpdate = function componentWillUpdate(props) {
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
  };

  Slider.prototype.valueChanged = function valueChanged() {
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
  };

  Slider.prototype.setValues = function setValues() {
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
  };

  Slider.prototype.setPosition = function setPosition(percent) {
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
  };

  Slider.prototype.onSliderClick = function onSliderClick(event) {
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
  };

  /* Watched Methods */


  Slider.prototype.onValueChanged = function onValueChanged(val) {
    var onChange = this.props.onChange;

    if (onChange) onChange(val);
  };

  Slider.prototype.onInputValueChanged = function onInputValueChanged(e) {
    var _this3 = this;

    this.setState({
      inputValue: e || 0,
      firstValue: e || 0
    }, function () {
      _this3.setValues();
    });
  };

  Slider.prototype.onFirstValueChange = function onFirstValueChange(value) {
    var _this4 = this;

    var firstValue = this.state.firstValue;

    if (firstValue !== value) {
      this.setState({ firstValue: value }, function () {
        return _this4.setValues();
      });
    }
  };

  Slider.prototype.onSecondValueChange = function onSecondValueChange(value) {
    var _this5 = this;

    var secondValue = this.state.secondValue;

    if (secondValue !== value) {
      this.setState({ secondValue: value }, function () {
        return _this5.setValues();
      });
    }
  };

  /* Computed Methods */

  Slider.prototype.sliderSize = function sliderSize() {
    var vertical = this.props.vertical;

    return parseInt(vertical ? this.slider.current.offsetHeight : this.slider.current.offsetWidth, 10);
  };

  Slider.prototype.stops = function stops() {
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
  };

  Slider.prototype.minValue = function minValue() {
    var _state5 = this.state,
        firstValue = _state5.firstValue,
        secondValue = _state5.secondValue;

    return Math.min(firstValue, secondValue);
  };

  Slider.prototype.maxValue = function maxValue() {
    var _state6 = this.state,
        firstValue = _state6.firstValue,
        secondValue = _state6.secondValue;

    return Math.max(firstValue, secondValue);
  };

  Slider.prototype.runwayStyle = function runwayStyle() {
    var _props7 = this.props,
        vertical = _props7.vertical,
        height = _props7.height;

    return vertical ? { height: height } : {};
  };

  Slider.prototype.barStyle = function barStyle() {
    var vertical = this.props.vertical;

    return vertical ? {
      height: this.barSize(),
      bottom: this.barStart()
    } : {
      width: this.barSize(),
      left: this.barStart()
    };
  };

  Slider.prototype.barSize = function barSize() {
    var firstValue = this.state.firstValue;
    var _props8 = this.props,
        range = _props8.range,
        max = _props8.max,
        min = _props8.min;

    return range ? 100 * (this.maxValue() - this.minValue()) / (max - min) + '%' : 100 * (firstValue - min) / (max - min) + '%';
  };

  Slider.prototype.barStart = function barStart() {
    var _props9 = this.props,
        range = _props9.range,
        max = _props9.max,
        min = _props9.min;

    return range ? 100 * (this.minValue() - min) / (max - min) + '%' : '0%';
  };

  Slider.prototype.render = function render() {
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


    return React.createElement(
      'div',
      { className: this.className('el-slider', {
          'is-vertical': vertical,
          'el-slider--with-input': showInput
        }) },
      showInput && !range && React.createElement(InputNumber, {
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
      React.createElement(
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
        React.createElement('div', {
          className: 'el-slider__bar',
          style: this.barStyle() }),
        React.createElement(SliderButton, {
          ref: this.button1,
          vertical: vertical, value: firstValue,
          onChange: this.onFirstValueChange.bind(this)
        }),
        range && React.createElement(SliderButton, {
          ref: this.button2,
          vertical: vertical, value: secondValue,
          onChange: this.onSecondValueChange.bind(this)
        }),
        showStops && this.stops().map(function (item, index) {
          return React.createElement('div', {
            key: index,
            className: 'el-slider__stop',
            style: vertical ? { 'bottom': item + '%' } : { 'left': item + '%' }
          });
        })
      )
    );
  };

  _createClass(Slider, [{
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
}(Component);

export default Slider;


Slider.childContextTypes = {
  component: PropTypes.any
};

Slider.propTypes = {
  min: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  step: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.arrayOf(PropTypes.number)]),
  showInput: PropTypes.bool,
  showInputControls: PropTypes.bool,
  showTooltip: PropTypes.bool,
  showStops: PropTypes.bool,
  disabled: PropTypes.bool,
  range: PropTypes.bool,
  vertical: PropTypes.bool,
  height: PropTypes.string,
  formatTooltip: PropTypes.func,
  onChange: PropTypes.func
};

Slider.defaultProps = {
  showTooltip: true,
  showInputControls: true,
  min: 0,
  max: 100,
  step: 1,
  value: 0
};