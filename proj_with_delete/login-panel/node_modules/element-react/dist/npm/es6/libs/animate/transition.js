import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import React, { Component } from 'react';
import { Transition as ReactTransition } from 'react-transition-group';
import { View } from '../';

var noneFun = function noneFun() {
  return undefined;
};

var Transition = function (_Component) {
  _inherits(Transition, _Component);

  function Transition() {
    _classCallCheck(this, Transition);

    return _possibleConstructorReturn(this, _Component.apply(this, arguments));
  }

  Transition.prototype.render = function render() {
    var _this2 = this;

    var _props = this.props,
        inProp = _props.in,
        _onEnter = _props.onEnter,
        _onEntering = _props.onEntering,
        _onEntered = _props.onEntered,
        _onExit = _props.onExit,
        _onExiting = _props.onExiting,
        _onExited = _props.onExited,
        _addEndListener = _props.addEndListener,
        unmountOnExit = _props.unmountOnExit,
        appear = _props.appear,
        duration = _props.duration,
        mountOnEnter = _props.mountOnEnter,
        transitionClass = _props.transitionClass;

    return React.createElement(
      ReactTransition,
      {
        onEnter: function onEnter() {
          return _onEnter();
        },
        onEntering: function onEntering() {
          return _onEntering();
        },
        onEntered: function onEntered() {
          return _onEntered();
        },
        onExit: function onExit() {
          return _onExit();
        },
        onExiting: function onExiting() {
          return _onExiting();
        },
        onExited: function onExited() {
          return _onExited();
        },
        addEndListener: function addEndListener() {
          return _addEndListener();
        },
        'in': inProp,
        mountOnEnter: mountOnEnter,
        unmountOnExit: unmountOnExit,
        appear: appear,
        timeout: duration
      },
      function (state) {
        return React.createElement(
          View,
          {
            className: transitionClass[state]
          },
          _this2.props.children
        );
      }
    );
  };

  return Transition;
}(Component);

Transition.defaultProps = {
  onEnter: noneFun,
  onEntering: noneFun,
  onEntered: noneFun,
  onExit: noneFun,
  onExiting: noneFun,
  onExited: noneFun,
  addEndListener: noneFun,
  mountOnEnter: false,
  unmountOnExit: false,
  appear: true,
  duration: 0
};

export default Transition;