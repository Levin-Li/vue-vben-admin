/**
 * tdesign v1.18.2
 * (c) 2026 tdesign
 * @license MIT
 */

import { defineComponent, ref, reactive, computed, onMounted, onBeforeUnmount, createVNode } from 'vue';
import { _ as _defineProperty } from '../../../_chunks/dep-fb621581.mjs';
import { e as SLIDER_DEFAULT_WIDTH } from '../../../_chunks/dep-f00ef76a.mjs';
import '../../utils/index.mjs';
import { useBaseClassName } from '../../hooks/index.mjs';
import baseProps from './base-props.mjs';
import { D as Draggable } from '../../../_chunks/dep-0f4e1c2c.mjs';
import '../../../_chunks/dep-18533aaa.mjs';
import '../../../_chunks/dep-9ae4ff58.mjs';
import '../../../_chunks/dep-fa00df7a.mjs';
import '../../../_chunks/dep-4616f1c8.mjs';
import '../../../_chunks/dep-bb862936.mjs';
import 'lodash-es';
import '../../../_chunks/dep-e85a98f4.mjs';
import '../../../_chunks/dep-c2119797.mjs';
import '../../../_chunks/dep-eb774c50.mjs';
import '../../../_chunks/dep-c982acb9.mjs';
import '../../../config-provider/hooks/useConfig.mjs';
import '../../../config-provider/utils/context.mjs';
import '../../../_chunks/dep-26fcd741.mjs';
import '../../../_chunks/dep-6728cfa8.mjs';
import '../../../_chunks/dep-b643f39a.mjs';
import '../../../_chunks/dep-c1b8686e.mjs';
import '../../../_chunks/dep-ae93a5c2.mjs';
import '../../../_chunks/dep-7a6f5a6f.mjs';
import '../../../_chunks/dep-d71d73b7.mjs';

function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
var ColorSlider = defineComponent({
  name: "ColorSlider",
  props: _objectSpread(_objectSpread({}, baseProps), {}, {
    className: {
      type: String,
      "default": ""
    },
    value: {
      type: Number,
      "default": 0
    },
    maxValue: {
      type: Number,
      "default": 360
    },
    railStyle: {
      type: Object
    },
    type: {
      type: String,
      "default": "hue"
    }
  }),
  setup: function setup(props) {
    var baseClassName = useBaseClassName();
    var refPanel = ref(null);
    var refThumb = ref(null);
    var dragInstance = ref(null);
    var panelRect = reactive({
      width: SLIDER_DEFAULT_WIDTH
    });
    var styles = computed(function () {
      var width = panelRect.width;
      if (!width) {
        return;
      }
      var left = Math.round(props.value / props.maxValue * 100);
      var color = props.type === "hue" ? "hsl(".concat(props.color.hue, ", 100%, 50%)") : props.color.rgba;
      return {
        left: "".concat(left, "%"),
        color: color
      };
    });
    var handleDrag = function handleDrag(coordinate, isEnded) {
      if (props.disabled) {
        return;
      }
      var width = panelRect.width;
      var x = coordinate.x;
      var value = Math.round(x / width * props.maxValue * 100) / 100;
      props.onChange(value, isEnded);
    };
    var handleDragEnd = function handleDragEnd(coordinate) {
      if (props.disabled) {
        return;
      }
      handleDrag(coordinate, true);
    };
    onMounted(function () {
      panelRect.width = refPanel.value.offsetWidth || SLIDER_DEFAULT_WIDTH;
      dragInstance.value = new Draggable(refPanel.value, {
        start: function start() {
          panelRect.width = refPanel.value.offsetWidth;
        },
        drag: function drag(coordinate) {
          handleDrag(coordinate);
        },
        end: handleDragEnd
      });
    });
    onBeforeUnmount(function () {
      dragInstance.value.destroy();
    });
    return function () {
      var paddingStyle = {
        background: "linear-gradient(90deg, rgba(0,0,0,.0) 0%, rgba(0,0,0,.0) 93%, ".concat(props.color.rgb, " 93%, ").concat(props.color.rgb, " 100%)")
      };
      return createVNode("div", {
        "class": ["".concat(baseClassName.value, "__slider-wrapper"), "".concat(baseClassName.value, "__slider-wrapper--").concat(props.type, "-type")]
      }, [props.type === "alpha" && createVNode("div", {
        "class": "".concat(baseClassName.value, "__slider-padding"),
        "style": paddingStyle
      }, null), createVNode("div", {
        "class": ["".concat(baseClassName.value, "__slider"), props.className],
        "ref": refPanel
      }, [createVNode("div", {
        "class": "".concat(baseClassName.value, "__rail"),
        "style": props.railStyle
      }, null), createVNode("span", {
        "class": ["".concat(baseClassName.value, "__thumb")],
        "role": "slider",
        "tabindex": 0,
        "ref": refThumb,
        "style": styles.value
      }, null)])]);
    };
  }
});

export { ColorSlider as default };
//# sourceMappingURL=slider.mjs.map
