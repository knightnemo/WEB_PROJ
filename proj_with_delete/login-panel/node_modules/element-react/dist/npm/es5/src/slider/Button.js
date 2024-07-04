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

var _tooltip = require('../tooltip');

var _tooltip2 = _interopRequireDefault(_tooltip);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(function () {
  var enterModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).enterModule;
  enterModule && enterModule(module);
})();

var SliderButton = function (_Component) {
  (0, _inherits3.default)(SliderButton, _Component);

  function SliderButton(props) {
    (0, _classCallCheck3.default)(this, SliderButton);

    var _this = (0, _possibleConstructorReturn3.default)(this, (SliderButton.__proto__ || Object.getPrototypeOf(SliderButton)).call(this, props));

    _this.state = {
      hovering: false,
      dragging: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      startPosition: 0,
      newPosition: 0
    };
    return _this;
  }

  (0, _createClass3.default)(SliderButton, [{
    key: 'parent',
    value: function parent() {
      return this.context.component;
    }
  }, {
    key: 'handleMouseEnter',
    value: function handleMouseEnter() {
      this.setState({
        hovering: true
      });
    }
  }, {
    key: 'handleMouseLeave',
    value: function handleMouseLeave() {
      this.setState({
        hovering: false
      });
    }
  }, {
    key: 'onButtonDown',
    value: function onButtonDown(event) {
      if (this.disabled()) return;

      this.onDragStart(event);

      window.addEventListener('mousemove', this.onDragging.bind(this));
      window.addEventListener('mouseup', this.onDragEnd.bind(this));
      window.addEventListener('contextmenu', this.onDragEnd.bind(this));
    }
  }, {
    key: 'onDragStart',
    value: function onDragStart(event) {
      this.setState({
        dragging: true,
        startX: event.clientX,
        startY: event.clientY,
        startPosition: parseInt(this.currentPosition(), 10)
      });
    }
  }, {
    key: 'onDragging',
    value: function onDragging(event) {
      var _this2 = this;

      var _state = this.state,
          dragging = _state.dragging,
          startY = _state.startY,
          currentY = _state.currentY,
          currentX = _state.currentX,
          startX = _state.startX,
          startPosition = _state.startPosition,
          newPosition = _state.newPosition;
      var vertical = this.props.vertical;

      if (dragging) {
        this.setState({
          currentX: event.clientX,
          currentY: event.clientY
        }, function () {
          var diff = void 0;
          if (vertical) {
            diff = (startY - currentY) / _this2.parent().sliderSize() * 100;
          } else {
            diff = (currentX - startX) / _this2.parent().sliderSize() * 100;
          }
          _this2.state.newPosition = startPosition + diff;
          _this2.setPosition(newPosition);
        });
      }
    }
  }, {
    key: 'onDragEnd',
    value: function onDragEnd() {
      var _this3 = this;

      var _state2 = this.state,
          dragging = _state2.dragging,
          newPosition = _state2.newPosition;

      if (dragging) {
        /*
         * 防止在 mouseup 后立即触发 click，导致滑块有几率产生一小段位移
         * 不使用 preventDefault 是因为 mouseup 和 click 没有注册在同一个 DOM 上
         */
        setTimeout(function () {
          _this3.setState({
            dragging: false
          }, function () {
            _this3.setPosition(newPosition);
          });
        }, 0);

        window.removeEventListener('mousemove', this.onDragging.bind(this));
        window.removeEventListener('mouseup', this.onDragEnd.bind(this));
        window.removeEventListener('contextmenu', this.onDragEnd.bind(this));
      }
    }
  }, {
    key: 'setPosition',
    value: function setPosition(newPosition) {
      if (newPosition < 0) {
        newPosition = 0;
      } else if (newPosition > 100) {
        newPosition = 100;
      }

      var lengthPerStep = 100 / ((this.max() - this.min()) / this.step());
      var steps = Math.round(newPosition / lengthPerStep);
      var value = steps * lengthPerStep * (this.max() - this.min()) * 0.01 + this.min();

      this.props.onChange(parseFloat(value.toFixed(this.precision())));
    }

    /* Computed Methods */

  }, {
    key: 'formatValue',
    value: function formatValue() {
      var formatTooltip = this.parent().props.formatTooltip;


      if (formatTooltip instanceof Function) {
        return formatTooltip(this.props.value);
      }

      return this.props.value;
    }
  }, {
    key: 'disabled',
    value: function disabled() {
      return this.parent().props.disabled;
    }
  }, {
    key: 'max',
    value: function max() {
      return this.parent().props.max;
    }
  }, {
    key: 'min',
    value: function min() {
      return this.parent().props.min;
    }
  }, {
    key: 'step',
    value: function step() {
      return this.parent().props.step;
    }
  }, {
    key: 'precision',
    value: function precision() {
      return this.parent().state.precision;
    }
  }, {
    key: 'currentPosition',
    value: function currentPosition() {
      return (this.props.value - this.min()) / (this.max() - this.min()) * 100 + '%';
    }
  }, {
    key: 'wrapperStyle',
    value: function wrapperStyle() {
      return this.props.vertical ? { bottom: this.currentPosition() } : { left: this.currentPosition() };
    }
  }, {
    key: 'render',
    value: function render() {
      var _state3 = this.state,
          hovering = _state3.hovering,
          dragging = _state3.dragging;


      return _react2.default.createElement(
        'div',
        {
          className: this.classNames('el-slider__button-wrapper', {
            'hover': hovering,
            'dragging': dragging
          }),
          style: this.wrapperStyle(),
          onMouseEnter: this.handleMouseEnter.bind(this),
          onMouseLeave: this.handleMouseLeave.bind(this),
          onMouseDown: this.onButtonDown.bind(this) },
        _react2.default.createElement(
          _tooltip2.default,
          {
            placement: 'top',
            content: _react2.default.createElement(
              'span',
              null,
              this.formatValue()
            ),
            disabled: !this.parent().props.showTooltip
          },
          _react2.default.createElement('div', {
            className: this.classNames('el-slider__button', {
              'hover': hovering,
              'dragging': dragging
            })
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
  }]);
  return SliderButton;
}(_libs.Component);

SliderButton.defaultProps = {
  value: 0
};
var _default = SliderButton;
exports.default = _default;


SliderButton.contextTypes = {
  component: _libs.PropTypes.any
};

SliderButton.propTypes = {
  onChange: _libs.PropTypes.func.isRequired,
  value: _libs.PropTypes.number,
  vertical: _libs.PropTypes.bool
};
;

(function () {
  var reactHotLoader = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).default;

  if (!reactHotLoader) {
    return;
  }

  reactHotLoader.register(SliderButton, 'SliderButton', 'src/slider/Button.jsx');
  reactHotLoader.register(_default, 'default', 'src/slider/Button.jsx');
})();

;

(function () {
  var leaveModule = (typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal : require('react-hot-loader')).leaveModule;
  leaveModule && leaveModule(module);
})();