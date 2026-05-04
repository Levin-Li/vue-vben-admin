/**
 * tdesign v1.18.2
 * (c) 2026 tdesign
 * @license MIT
 */

import { defineComponent, createVNode } from 'vue';
import { FileCopyIcon } from 'tdesign-icons-vue-next';
import { copyText } from './utils/index.mjs';
import { MessagePlugin } from '../message/plugin.mjs';
import props from './anchor-target-props.mjs';
import { Popup } from '../popup/index.mjs';
import { i as useGlobalIcon, u as usePrefixClass } from '../_chunks/dep-c2119797.mjs';
import { useConfig } from '../config-provider/hooks/useConfig.mjs';
import '../_chunks/dep-c982acb9.mjs';
import '../_chunks/dep-fb621581.mjs';
import '../_chunks/dep-18533aaa.mjs';
import 'lodash-es';
import '../_chunks/dep-eb774c50.mjs';
import '../message/message-list.mjs';
import '../_chunks/dep-23e38a03.mjs';
import '../loading/index.mjs';
import '../loading/directive.mjs';
import '../loading/plugin.mjs';
import '../loading/loading.mjs';
import '../_chunks/dep-9ae4ff58.mjs';
import '../_chunks/dep-fa00df7a.mjs';
import '../loading/icon/gradient.mjs';
import '../_chunks/dep-5ad8fdfc.mjs';
import '../_chunks/dep-e85a98f4.mjs';
import '../_chunks/dep-089d5b50.mjs';
import '../loading/props.mjs';
import '../config-provider/utils/context.mjs';
import '../_chunks/dep-26fcd741.mjs';
import '../_chunks/dep-6728cfa8.mjs';
import '../_chunks/dep-b643f39a.mjs';
import '../_chunks/dep-c1b8686e.mjs';
import '../_chunks/dep-ae93a5c2.mjs';
import '../_chunks/dep-7a6f5a6f.mjs';
import '../_chunks/dep-4616f1c8.mjs';
import '../_chunks/dep-d71d73b7.mjs';
import './style/css.mjs';
import '../message/props.mjs';
import '../popup/popup.mjs';
import '@popperjs/core';
import '../popup/container.mjs';
import '../popup/props.mjs';

var _AnchorTarget = defineComponent({
  name: "TAnchorTarget",
  props: props,
  setup: function setup(props2, _ref) {
    var slots = _ref.slots;
    var _useConfig = useConfig("anchor"),
      globalConfig = _useConfig.globalConfig,
      classPrefix = _useConfig.classPrefix;
    var _useGlobalIcon = useGlobalIcon({
        FileCopyIcon: FileCopyIcon
      }),
      FileCopyIcon$1 = _useGlobalIcon.FileCopyIcon;
    var COMPONENT_NAME = usePrefixClass("anchor");
    var toCopyText = function toCopyText() {
      var a = document.createElement("a");
      a.href = "#".concat(props2.id);
      copyText(a.href);
      MessagePlugin.success(globalConfig.value.copySuccessText, 1e3);
    };
    return function () {
      var children = slots["default"];
      var TAG = props2.tag,
        id = props2.id;
      var className = ["".concat(COMPONENT_NAME.value, "__target")];
      var iconClassName = "".concat(classPrefix.value, "-copy");
      return createVNode(TAG, {
        "id": id,
        "class": className
      }, {
        "default": function _default() {
          return [children && children(null), createVNode(Popup, {
            "content": globalConfig.value.copyText,
            "placement": "top",
            "showArrow": true,
            "class": iconClassName
          }, {
            "default": function _default() {
              return [createVNode(FileCopyIcon$1, {
                "onClick": toCopyText
              }, null)];
            }
          })];
        }
      });
    };
  }
});

export { _AnchorTarget as default };
//# sourceMappingURL=anchor-target.mjs.map
