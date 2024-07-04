import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import React from 'react';
import { Component, View, Transition, PropTypes } from '../../libs';
import { cleanScrollBar } from '../table/utils';

var Dialog = function (_Component) {
  _inherits(Dialog, _Component);

  function Dialog(props) {
    _classCallCheck(this, Dialog);

    var _this = _possibleConstructorReturn(this, _Component.call(this, props));

    _this.wrap = React.createRef();
    _this.state = {
      bodyOverflow: ''
    };
    return _this;
  }

  Dialog.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps) {
    var bodyOverflow = this.state.bodyOverflow;
    var _props = this.props,
        lockScroll = _props.lockScroll,
        modal = _props.modal;

    if (this.willOpen(this.props, nextProps)) {
      cleanScrollBar();
      if (lockScroll && document.body && document.body.style) {
        if (!bodyOverflow) {
          this.setState({
            bodyOverflow: document.body.style.overflow
          });
        }
        document.body.style.overflow = 'hidden';
      }
    }

    if (this.willClose(this.props, nextProps) && lockScroll) {
      if (modal && bodyOverflow !== 'hidden' && document.body && document.body.style) {
        document.body.style.overflow = bodyOverflow;
      }
    }
  };

  Dialog.prototype.componentDidUpdate = function componentDidUpdate(prevProps) {
    if (this.willOpen(prevProps, this.props)) {
      this.wrap.current.focus();
    }
  };

  Dialog.prototype.componentWillUnmount = function componentWillUnmount() {
    var lockScroll = this.props.lockScroll;

    if (lockScroll && document.body && document.body.style) {
      document.body.style.removeProperty('overflow');
    }
  };

  Dialog.prototype.onKeyDown = function onKeyDown(e) {
    var closeOnPressEscape = this.props.closeOnPressEscape;

    if (closeOnPressEscape && e.keyCode === 27) {
      this.close(e);
    }
  };

  Dialog.prototype.handleWrapperClick = function handleWrapperClick(e) {
    var closeOnClickModal = this.props.closeOnClickModal;

    if (e.target instanceof HTMLDivElement) {
      if (closeOnClickModal && e.target === e.currentTarget) {
        this.close(e);
      }
    }
  };

  Dialog.prototype.close = function close(e) {
    this.props.onCancel(e);
  };

  Dialog.prototype.willOpen = function willOpen(prevProps, nextProps) {
    return !prevProps.visible && nextProps.visible;
  };

  Dialog.prototype.willClose = function willClose(prevProps, nextProps) {
    return prevProps.visible && !nextProps.visible;
  };

  Dialog.prototype.render = function render() {
    var _this2 = this;

    var _props2 = this.props,
        visible = _props2.visible,
        title = _props2.title,
        size = _props2.size,
        top = _props2.top,
        modal = _props2.modal,
        customClass = _props2.customClass,
        showClose = _props2.showClose,
        children = _props2.children;


    return React.createElement(
      'div',
      null,
      React.createElement(
        Transition,
        { name: 'dialog-fade' },
        React.createElement(
          View,
          { show: visible },
          React.createElement(
            'div',
            {
              ref: this.wrap,
              style: { zIndex: 1013 },
              className: this.classNames('el-dialog__wrapper'),
              onClick: function onClick(e) {
                return _this2.handleWrapperClick(e);
              },
              onKeyDown: function onKeyDown(e) {
                return _this2.onKeyDown(e);
              }
            },
            React.createElement(
              'div',
              {
                ref: 'dialog',
                style: this.style(size === 'full' ? {} : { 'top': top }),
                className: this.className("el-dialog", 'el-dialog--' + size, customClass)
              },
              React.createElement(
                'div',
                { className: 'el-dialog__header' },
                React.createElement(
                  'span',
                  { className: 'el-dialog__title' },
                  title
                ),
                showClose && React.createElement(
                  'button',
                  { type: 'button', className: 'el-dialog__headerbtn', onClick: function onClick(e) {
                      return _this2.close(e);
                    } },
                  React.createElement('i', { className: 'el-dialog__close el-icon el-icon-close' })
                )
              ),
              children
            )
          )
        )
      ),
      modal && React.createElement(
        View,
        { show: visible },
        React.createElement('div', { className: 'v-modal', style: { zIndex: 1012 } })
      )
    );
  };

  return Dialog;
}(Component);

Dialog.defaultProps = {
  visible: false,
  title: '',
  size: 'small',
  top: '15%',
  modal: true,
  lockScroll: true,
  closeOnClickModal: true,
  closeOnPressEscape: true,
  showClose: true
};
export default Dialog;


Dialog.propTypes = {
  // 控制对话框是否可见
  visible: PropTypes.bool.isRequired,
  // 标题
  title: PropTypes.string,
  // 大小 (tiny/small/large/full)
  size: PropTypes.string,
  // top 值（仅在 size 不为 full 时有效）
  top: PropTypes.string,
  // 控制遮罩层展示
  modal: PropTypes.bool,
  // Dialog 的自定义类名
  customClass: PropTypes.string,
  // 是否在 Dialog 出现时将 body 滚动锁定
  lockScroll: PropTypes.bool,
  // 是否可以通过点击 modal 关闭 Dialog
  closeOnClickModal: PropTypes.bool,
  // 是否可以通过按下 ESC 关闭 Dialog
  closeOnPressEscape: PropTypes.bool,
  // 点击遮罩层或右上角叉或取消按钮的回调
  onCancel: PropTypes.func.isRequired,
  showClose: PropTypes.bool
};