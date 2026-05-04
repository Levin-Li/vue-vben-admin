/**
 * tdesign v1.18.2
 * (c) 2026 tdesign
 * @license MIT
 */

import { defineComponent, computed, createVNode } from 'vue';
import ColorSlider from './slider.mjs';
import { useBaseClassName } from '../../hooks/index.mjs';
import '../../../_chunks/dep-fb621581.mjs';
import '../../../_chunks/dep-18533aaa.mjs';
import '../../../_chunks/dep-f00ef76a.mjs';
import '../../utils/index.mjs';
import '../../../_chunks/dep-0f4e1c2c.mjs';
import '../../../_chunks/dep-9ae4ff58.mjs';
import '../../../_chunks/dep-fa00df7a.mjs';
import '../../../_chunks/dep-4616f1c8.mjs';
import '../../../_chunks/dep-bb862936.mjs';
import 'lodash-es';
import '../../../_chunks/dep-e85a98f4.mjs';
import './base-props.mjs';
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

var AlphaSlider = defineComponent({
  name: "AlphaSlider",
  inheritAttrs: false,
  props: {
    color: {
      type: Object
    },
    disabled: {
      type: Boolean,
      "default": false
    },
    onChange: {
      type: Function,
      "default": function _default() {
        return function () {};
      }
    }
  },
  setup: function setup(props) {
    var baseClassName = useBaseClassName();
    var handleChange = function handleChange(v, isDragEnd) {
      props.onChange(v / 100, isDragEnd);
    };
    var railStyle = computed(function () {
      return {
        background: "linear-gradient(to right, rgba(0, 0, 0, 0), ".concat(props.color.rgb, ")")
      };
    });
    return function () {
      return createVNode(ColorSlider, {
        "class": ["".concat(baseClassName.value, "__alpha"), "".concat(baseClassName.value, "--bg-alpha")],
        "color": props.color,
        "value": props.color.alpha * 100,
        "onChange": handleChange,
        "rail-style": railStyle.value,
        "max-value": 100,
        "disabled": props.disabled,
        "type": "alpha"
      }, null);
    };
  }
});

export { AlphaSlider as default };
//# sourceMappingURL=alpha.mjs.map
