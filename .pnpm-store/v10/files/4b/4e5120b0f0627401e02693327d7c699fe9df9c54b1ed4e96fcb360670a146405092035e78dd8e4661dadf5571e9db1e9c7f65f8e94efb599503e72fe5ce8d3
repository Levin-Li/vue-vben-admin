/**
 * tdesign v1.18.2
 * (c) 2026 tdesign
 * @license MIT
 */

import _defineProperty from '@babel/runtime/helpers/defineProperty';
import { defineComponent, provide, createVNode, isVNode } from 'vue';
import props from './avatar-group-props.js';
import _Avatar from './avatar.js';
import 'lodash-es';
import '@babel/runtime/helpers/toConsumableArray';
import '@babel/runtime/helpers/typeof';
import '../_chunks/dep-53e6346b.js';
import { g as getChildren } from '../_chunks/dep-0b052ff6.js';
import { u as useTNodeJSX } from '../_chunks/dep-8da78633.js';
import { u as usePrefixClass } from '../_chunks/dep-8e303224.js';
import '@babel/runtime/helpers/slicedToArray';
import '../_chunks/dep-d05b388b.js';
import './props.js';
import '../_chunks/dep-8004d9ee.js';
import '../config-provider/hooks/useConfig.js';
import '../config-provider/utils/context.js';
import '../_chunks/dep-a6f9a9f8.js';
import '../_chunks/dep-e12c71fd.js';
import 'dayjs';
import '../image/index.js';
import '../image/image.js';
import 'tdesign-icons-vue-next';
import '../_chunks/dep-fd731a39.js';
import '../_chunks/dep-427641a9.js';
import '../_chunks/dep-737e13ea.js';
import '../_chunks/dep-cc5c1409.js';
import '../image/props.js';
import '../space/index.js';
import '../space/space.js';
import '../space/props.js';
import '../_chunks/dep-5e2572cd.js';
import '../_chunks/dep-332d72a8.js';
import '@babel/runtime/helpers/objectWithoutProperties';
import '../_chunks/dep-ef950b92.js';
import '@babel/runtime/helpers/createClass';
import '@babel/runtime/helpers/classCallCheck';
import '../_chunks/dep-5a065472.js';
import 'tdesign-vue-next/esm/common/style/web/components/space/_index.less';
import 'tdesign-vue-next/esm/common/style/web/components/image/_index.less';

function _isSlot(s) {
  return typeof s === 'function' || Object.prototype.toString.call(s) === '[object Object]' && !isVNode(s);
}
var _AvatarGroup = defineComponent({
  name: "TAvatarGroup",
  props: props,
  setup: function setup(props2) {
    provide("avatarGroup", props2);
    var renderTNodeJSX = useTNodeJSX();
    var AVATAR_NAME = usePrefixClass("avatar");
    var COMPONENT_NAME = usePrefixClass("avatar-group");
    var renderEllipsisAvatar = function renderEllipsisAvatar(children) {
      if ((children === null || children === void 0 ? void 0 : children.length) > props2.max) {
        var content = getEllipsisContent(children);
        var outAvatar = children.slice(0, props2.max);
        outAvatar.push(createVNode(_Avatar, {
          "class": "".concat(AVATAR_NAME.value, "__collapse"),
          "size": props2.size
        }, _isSlot(content) ? content : {
          "default": function _default() {
            return [content];
          }
        }));
        return outAvatar;
      }
      return children;
    };
    var getEllipsisContent = function getEllipsisContent(children) {
      return renderTNodeJSX("collapseAvatar") || "+".concat(children.length - props2.max);
    };
    return function () {
      var children = renderTNodeJSX("default");
      var cascading = props2.cascading,
        max = props2.max;
      var groupClass = ["".concat(COMPONENT_NAME.value), _defineProperty(_defineProperty({}, "".concat(AVATAR_NAME.value, "--offset-right"), cascading === "right-up"), "".concat(AVATAR_NAME.value, "--offset-left"), cascading === "left-up")];
      var content = max && max >= 0 ? [renderEllipsisAvatar(getChildren(children))] : [children];
      return createVNode("div", {
        "class": groupClass
      }, [content]);
    };
  }
});

export { _AvatarGroup as default };
//# sourceMappingURL=group.js.map
