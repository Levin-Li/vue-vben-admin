/**
 * tdesign v1.18.2
 * (c) 2026 tdesign
 * @license MIT
 */

'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var Vue = require('vue');
var list_listItemMetaProps = require('./list-item-meta-props.js');
require('@babel/runtime/helpers/toConsumableArray');
require('@babel/runtime/helpers/typeof');
require('../_chunks/dep-110c4506.js');
var index$1 = require('../_chunks/dep-22864d8c.js');
var index = require('../_chunks/dep-260f2492.js');
require('@babel/runtime/helpers/slicedToArray');
require('../_chunks/dep-47a6d229.js');
require('@babel/runtime/helpers/defineProperty');
var isString = require('../_chunks/dep-0aa9055c.js');
require('../_chunks/dep-d9203944.js');
require('../_chunks/dep-23e00954.js');
require('../_chunks/dep-7ebecea9.js');
require('../_chunks/dep-9d1c5d1b.js');
require('../_chunks/dep-460751e4.js');
require('../_chunks/dep-f84f5bb1.js');
require('../_chunks/dep-516f9c19.js');
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

var _ListItemMeta = Vue.defineComponent({
  name: "TListItemMeta",
  props: list_listItemMetaProps["default"],
  setup: function setup(props2, ctx) {
    var COMPONENT_NAME = index.usePrefixClass("list-item__meta");
    var renderContent = index$1.useContent();
    var renderTNodeJSX = index$1.useTNodeJSX();
    var renderAvatar = function renderAvatar() {
      if (props2.avatar || ctx.slots.avatar) {
        console.warn("`avatar` is going to be deprecated, please use `image` instead");
      }
      var thumbnail = renderContent("avatar", "image");
      if (!thumbnail) return;
      if (isString.isString(thumbnail)) {
        return Vue.createVNode("div", {
          "class": "".concat(COMPONENT_NAME.value, "-avatar")
        }, [Vue.createVNode("img", {
          "src": thumbnail
        }, null)]);
      }
      return Vue.createVNode("div", {
        "class": "".concat(COMPONENT_NAME.value, "-avatar")
      }, [thumbnail]);
    };
    return function () {
      var propsTitleContent = renderTNodeJSX("title");
      var propsDescriptionContent = renderTNodeJSX("description");
      var listItemMetaContent = [renderAvatar(), Vue.createVNode("div", {
        "class": "".concat(COMPONENT_NAME.value, "-content")
      }, [propsTitleContent && Vue.createVNode("h3", {
        "class": "".concat(COMPONENT_NAME.value, "-title")
      }, [propsTitleContent]), propsDescriptionContent && Vue.createVNode("p", {
        "class": "".concat(COMPONENT_NAME.value, "-description")
      }, [propsDescriptionContent])])];
      return Vue.createVNode("div", {
        "class": COMPONENT_NAME.value
      }, [listItemMetaContent]);
    };
  }
});

exports["default"] = _ListItemMeta;
//# sourceMappingURL=list-item-meta.js.map
