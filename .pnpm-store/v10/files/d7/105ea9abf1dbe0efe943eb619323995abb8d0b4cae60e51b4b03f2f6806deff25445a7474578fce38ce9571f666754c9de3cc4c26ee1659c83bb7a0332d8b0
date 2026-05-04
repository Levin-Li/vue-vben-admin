/**
 * tdesign v1.18.2
 * (c) 2026 tdesign
 * @license MIT
 */

'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var Vue = require('vue');
var _defineProperty = require('@babel/runtime/helpers/defineProperty');
var timeline_timelineItemProps = require('./timeline-item-props.js');
require('@babel/runtime/helpers/toConsumableArray');
require('@babel/runtime/helpers/typeof');
require('../_chunks/dep-110c4506.js');
var index$1 = require('../_chunks/dep-22864d8c.js');
var index = require('../_chunks/dep-260f2492.js');
require('@babel/runtime/helpers/slicedToArray');
require('../_chunks/dep-47a6d229.js');
var timeline_hooks_index = require('./hooks/index.js');
var loading_index = require('../loading/index.js');
var omit = require('../_chunks/dep-5a9d4e56.js');
require('../_chunks/dep-d9203944.js');
require('../_chunks/dep-23e00954.js');
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
require('../config-provider/hooks/useConfig.js');
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
require('../_chunks/dep-91bbb82c.js');
require('../_chunks/dep-16c8d355.js');
require('../_chunks/dep-9a7f339b.js');
require('../_chunks/dep-b06c414b.js');
require('@babel/runtime/helpers/createClass');
require('@babel/runtime/helpers/classCallCheck');
require('../_chunks/dep-c1fe6425.js');
require('../loading/plugin.js');
require('../_chunks/dep-20a989b6.js');
require('../loading/icon/gradient.js');
require('../_chunks/dep-a3f10d40.js');
require('../_chunks/dep-0a5ee5d1.js');
require('@babel/runtime/helpers/objectWithoutProperties');
require('../_chunks/dep-0dfb856c.js');
require('../_chunks/dep-f8163869.js');
require('../_chunks/dep-7e514e61.js');
require('../_chunks/dep-526dfc98.js');
require('../loading/props.js');
require('../_chunks/dep-0f2379ad.js');
require('../_chunks/dep-a1d79004.js');
require('../_chunks/dep-af286901.js');
require('../_chunks/dep-f8074d90.js');
require('../_chunks/dep-d2dcc7ae.js');
require('../_chunks/dep-fc13d8ec.js');
require('../_chunks/dep-b361eede.js');
require('../_chunks/dep-69bb1fda.js');
require('../_chunks/dep-674dfb17.js');
require('../_chunks/dep-d4d6b0ce.js');
require('../_chunks/dep-de5f9805.js');
require('../_chunks/dep-8d8335c4.js');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var _defineProperty__default = /*#__PURE__*/_interopDefaultLegacy(_defineProperty);

function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty__default["default"](e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
var DEFAULT_THEME = ["default", "primary", "success", "warning", "error"];
var _TimelineItem = Vue.defineComponent({
  name: "TTimelineItem",
  props: _objectSpread(_objectSpread({}, timeline_timelineItemProps["default"]), {}, {
    index: {
      type: Number
    }
  }),
  setup: function setup(props2) {
    var COMPONENT_NAME = index.usePrefixClass("timeline-item");
    var TimelineProvider = Vue.inject(timeline_hooks_index.TimelineInjectKey, timeline_hooks_index.DEFAULT_PROVIDER);
    var renderContent = index$1.useContent();
    var renderTNodeJSX = index$1.useTNodeJSX();
    var getPositionClassName = function getPositionClassName(index) {
      var _props2$labelAlign;
      var _TimelineProvider$val = TimelineProvider.value,
        layout = _TimelineProvider$val.layout,
        renderAlign = _TimelineProvider$val.renderAlign;
      var timelineItemAlign = (_props2$labelAlign = props2.labelAlign) !== null && _props2$labelAlign !== void 0 ? _props2$labelAlign : renderAlign;
      var left = layout === "horizontal" ? "top" : "left";
      var right = layout === "horizontal" ? "bottom" : "right";
      if (timelineItemAlign === "alternate") {
        return index % 2 === 0 ? "".concat(COMPONENT_NAME.value, "-").concat(left) : "".concat(COMPONENT_NAME.value, "-").concat(right);
      }
      if (timelineItemAlign === "left" || timelineItemAlign === "top") {
        return "".concat(COMPONENT_NAME.value, "-").concat(left);
      }
      if (timelineItemAlign === "right" || timelineItemAlign === "bottom") {
        return "".concat(COMPONENT_NAME.value, "-").concat(right);
      }
      return "";
    };
    var handleClick = function handleClick(e) {
      var _props2$onClick;
      (_props2$onClick = props2.onClick) === null || _props2$onClick === void 0 || _props2$onClick.call(props2, {
        e: e,
        item: omit.omit(props2, ["index"])
      });
    };
    return function () {
      var _TimelineProvider$val2 = TimelineProvider.value,
        mode = _TimelineProvider$val2.mode,
        theme = _TimelineProvider$val2.theme,
        itemsStatus = _TimelineProvider$val2.itemsStatus,
        reverse = _TimelineProvider$val2.reverse;
      var loading = props2.loading,
        dotColor = props2.dotColor,
        index = props2.index;
      var labelNode = renderTNodeJSX("label");
      var dotElement = renderTNodeJSX("dot");
      var dotContentClass = "".concat(COMPONENT_NAME.value, "__dot-content");
      if (dotElement !== null && dotElement !== void 0 && dotElement.props) {
        var _dotElement$props;
        var classes = dotElement === null || dotElement === void 0 || (_dotElement$props = dotElement.props) === null || _dotElement$props === void 0 ? void 0 : _dotElement$props["class"];
        dotElement.props["class"] = classes ? [dotContentClass, classes].join(" ") : dotContentClass;
      }
      return Vue.createVNode("li", {
        "class": ["".concat(COMPONENT_NAME.value), "".concat(getPositionClassName(props2.index))],
        "onClick": handleClick
      }, [mode === "alternate" && labelNode && Vue.createVNode("div", {
        "class": ["".concat(COMPONENT_NAME.value, "__label"), "".concat(COMPONENT_NAME.value, "__label--").concat(mode)]
      }, [labelNode]), Vue.createVNode("div", {
        "class": "".concat(COMPONENT_NAME.value, "__wrapper")
      }, [Vue.createVNode("div", {
        "class": _defineProperty__default["default"](_defineProperty__default["default"](_defineProperty__default["default"]({}, "".concat(COMPONENT_NAME.value, "__dot"), true), "".concat(COMPONENT_NAME.value, "__dot--custom"), !!dotElement || !dotElement && loading), "".concat(COMPONENT_NAME.value, "__dot--").concat(dotColor), DEFAULT_THEME.includes(dotColor)),
        "style": {
          borderColor: !DEFAULT_THEME.includes(dotColor) && dotColor
        }
      }, [!dotElement && loading && Vue.createVNode(loading_index.Loading, {
        "size": "12px",
        "class": dotContentClass
      }, null), dotElement]), Vue.createVNode("div", {
        "class": _defineProperty__default["default"](_defineProperty__default["default"](_defineProperty__default["default"]({}, "".concat(COMPONENT_NAME.value, "__tail"), true), "".concat(COMPONENT_NAME.value, "__tail--theme-").concat(theme), true), "".concat(COMPONENT_NAME.value, "__tail--status-").concat(itemsStatus[index]), reverse)
      }, null)]), Vue.createVNode("div", {
        "class": "".concat(COMPONENT_NAME.value, "__content")
      }, [renderContent("default", "content"), mode === "same" && labelNode && Vue.createVNode("div", {
        "class": ["".concat(COMPONENT_NAME.value, "__label"), "".concat(COMPONENT_NAME.value, "__label--").concat(mode)]
      }, [labelNode])])]);
    };
  }
});

exports["default"] = _TimelineItem;
//# sourceMappingURL=timeline-item.js.map
