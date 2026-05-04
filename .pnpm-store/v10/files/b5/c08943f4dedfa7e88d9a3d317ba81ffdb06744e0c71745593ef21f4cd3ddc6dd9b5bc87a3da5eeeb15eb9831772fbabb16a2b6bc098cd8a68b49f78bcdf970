/**
 * tdesign v1.18.2
 * (c) 2026 tdesign
 * @license MIT
 */

'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var Vue = require('vue');
var _defineProperty = require('@babel/runtime/helpers/defineProperty');
var _typeof = require('@babel/runtime/helpers/typeof');
var tdesignIconsVueNext = require('tdesign-icons-vue-next');
var dom = require('../_chunks/dep-23e00954.js');
var index$3 = require('../_chunks/dep-0ac2faad.js');
var index$2 = require('../_chunks/dep-22864d8c.js');
var index = require('../_chunks/dep-260f2492.js');
var index$1 = require('../_chunks/dep-de5aac0e.js');
require('@babel/runtime/helpers/slicedToArray');
require('../_chunks/dep-47a6d229.js');
require('@babel/runtime/helpers/toConsumableArray');
var backTop_props = require('./props.js');
var configProvider_hooks_useConfig = require('../config-provider/hooks/useConfig.js');
require('../_chunks/dep-110c4506.js');
require('../_chunks/dep-d9203944.js');
require('../_chunks/dep-7ebecea9.js');
require('../_chunks/dep-9d1c5d1b.js');
require('../_chunks/dep-460751e4.js');
require('../_chunks/dep-0aa9055c.js');
require('../_chunks/dep-516f9c19.js');
require('../_chunks/dep-f84f5bb1.js');
require('../_chunks/dep-14a4602c.js');
require('../_chunks/dep-550c1f49.js');
require('../_chunks/dep-b8ff5f63.js');
require('../_chunks/dep-48fd1561.js');
require('../_chunks/dep-ba16dbb9.js');
require('../_chunks/dep-8f150572.js');
require('../_chunks/dep-4f15f63d.js');
require('../_chunks/dep-dc2aae04.js');
require('../_chunks/dep-54a1dd2c.js');
require('dayjs');
require('../_chunks/dep-6e6bb353.js');
require('../_chunks/dep-b6a6fb6b.js');
require('../_chunks/dep-7cef7c9c.js');
require('../_chunks/dep-7c68cd5e.js');
require('../_chunks/dep-b780f7c8.js');
require('../_chunks/dep-1a571cb2.js');
require('../_chunks/dep-02b411a3.js');
require('../_chunks/dep-b0ff7f66.js');
require('../_chunks/dep-0d4923b4.js');
require('../_chunks/dep-397a48fa.js');
require('../_chunks/dep-8a38ec70.js');
require('@babel/runtime/helpers/createClass');
require('@babel/runtime/helpers/classCallCheck');
require('../_chunks/dep-91bbb82c.js');
require('../_chunks/dep-16c8d355.js');
require('../_chunks/dep-9a7f339b.js');
require('../_chunks/dep-b06c414b.js');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var _defineProperty__default = /*#__PURE__*/_interopDefaultLegacy(_defineProperty);
var _typeof__default = /*#__PURE__*/_interopDefaultLegacy(_typeof);

var _BackTop = Vue.defineComponent({
  name: "TBackTop",
  props: backTop_props["default"],
  setup: function setup(props2) {
    var visible = Vue.ref(false);
    var containerRef = Vue.ref(null);
    var componentName = index.usePrefixClass("back-top");
    var _useConfig = configProvider_hooks_useConfig.useConfig("alert"),
      classPrefix = _useConfig.classPrefix;
    var _useGlobalIcon = index$1.useGlobalIcon({
        BacktopIcon: tdesignIconsVueNext.BacktopIcon
      }),
      BacktopIcon = _useGlobalIcon.BacktopIcon;
    var renderContent = index$2.useContent();
    var getContainer = function getContainer(container) {
      if (typeof container === "string" && (typeof document === "undefined" ? "undefined" : _typeof__default["default"](document)) !== void 0) {
        if (container === "body") {
          return document;
        }
        return document.querySelector(container);
      }
      if (typeof container === "function") {
        return container();
      }
      return null;
    };
    Vue.onMounted(function () {
      containerRef.value = getContainer(props2.container);
      var visibleHeight;
      if (typeof props2.visibleHeight === "string") {
        visibleHeight = Number(props2.visibleHeight.replace("px", ""));
      } else {
        visibleHeight = props2.visibleHeight;
      }
      if (visibleHeight === 0) {
        visible.value = true;
        return;
      }
      var scrollDOM;
      if (containerRef.value.scrollTop === void 0) {
        scrollDOM = document.documentElement;
      } else {
        scrollDOM = containerRef.value;
      }
      containerRef.value.onscroll = function () {
        var _scrollDOM;
        var scrollTop = (_scrollDOM = scrollDOM) === null || _scrollDOM === void 0 ? void 0 : _scrollDOM.scrollTop;
        if (scrollTop >= visibleHeight) {
          visible.value = true;
        }
        if (scrollTop < visibleHeight && visible.value) {
          visible.value = false;
        }
      };
    });
    Vue.onBeforeUnmount(function () {
      containerRef.value.onscroll = null;
    });
    return function () {
      var theme = props2.theme,
        shape = props2.shape,
        size = props2.size,
        target = props2.target,
        duration = props2.duration,
        offset = props2.offset,
        container = props2.container;
      var getChild = index$3.useChildSlots();
      var children = getChild();
      if (children.length < 1) children = null;
      var cls = Vue.computed(function () {
        return _defineProperty__default["default"](_defineProperty__default["default"](_defineProperty__default["default"](_defineProperty__default["default"](_defineProperty__default["default"](_defineProperty__default["default"]({}, componentName.value, true), "".concat(componentName.value, "--theme-").concat(theme), true), "".concat(componentName.value, "--").concat(shape), true), "".concat(componentName.value, "--show"), visible.value), "".concat(classPrefix.value, "-size-s"), size === "small"), "".concat(classPrefix.value, "-size-m"), size === "medium");
      });
      var defaultContent = Vue.createVNode(Vue.Fragment, null, [Vue.createVNode(BacktopIcon, {
        "class": "".concat(componentName.value, "__icon"),
        "size": "24"
      }, null), Vue.createVNode("span", {
        "class": "".concat(componentName.value, "__text")
      }, [Vue.createTextVNode("TOP")])]);
      var getBackTo = function getBackTo() {
        if (target === container) return 0;
        if (target === "body") return 0;
        if (!target) return 0;
        var targetNode = getContainer(target);
        if (!targetNode) return 0;
        var y = targetNode.getBoundingClientRect().y;
        return y;
      };
      var handleClick = function handleClick(e) {
        var _props2$onClick;
        var y = getBackTo();
        dom.scrollTo(y, {
          container: containerRef.value,
          duration: duration
        });
        (_props2$onClick = props2.onClick) === null || _props2$onClick === void 0 || _props2$onClick.call(props2, {
          e: e
        });
      };
      var positionStyle = Vue.computed(function () {
        return {
          insetInlineEnd: offset[0],
          insetBlockEnd: offset[1]
        };
      });
      return Vue.createVNode("button", {
        "type": "button",
        "class": cls.value,
        "style": positionStyle.value,
        "onClick": handleClick
      }, [renderContent("content", "default", defaultContent)]);
    };
  }
});

exports["default"] = _BackTop;
//# sourceMappingURL=back-top.js.map
