/**
 * tdesign v1.18.2
 * (c) 2026 tdesign
 * @license MIT
 */

'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tree_utils_index = require('../utils/index.js');
var tree_hooks_useTreeAction = require('./useTreeAction.js');
require('@babel/runtime/helpers/defineProperty');
require('vue');
require('@babel/runtime/helpers/toConsumableArray');
require('@babel/runtime/helpers/typeof');
require('../../_chunks/dep-110c4506.js');
require('../../_chunks/dep-d9203944.js');
require('../../config-provider/hooks/useConfig.js');
require('../../_chunks/dep-dc2aae04.js');
require('../../_chunks/dep-54a1dd2c.js');
require('dayjs');
require('../../_chunks/dep-6e6bb353.js');
require('../../_chunks/dep-b6a6fb6b.js');
require('../../_chunks/dep-7cef7c9c.js');
require('../../_chunks/dep-7ebecea9.js');
require('../../_chunks/dep-9d1c5d1b.js');
require('../../_chunks/dep-460751e4.js');
require('../../_chunks/dep-7c68cd5e.js');
require('../../_chunks/dep-b780f7c8.js');
require('../../_chunks/dep-516f9c19.js');
require('../../_chunks/dep-1a571cb2.js');
require('../../_chunks/dep-02b411a3.js');
require('../../_chunks/dep-b0ff7f66.js');
require('../../_chunks/dep-0d4923b4.js');
require('../../_chunks/dep-397a48fa.js');
require('../../_chunks/dep-8a38ec70.js');
require('@babel/runtime/helpers/slicedToArray');
require('../../_chunks/dep-0aa9055c.js');
require('../../_chunks/dep-91bbb82c.js');
require('../../_chunks/dep-16c8d355.js');
require('../../_chunks/dep-9a7f339b.js');
require('../../_chunks/dep-b06c414b.js');
require('../../_chunks/dep-47a6d229.js');
require('@babel/runtime/helpers/createClass');
require('@babel/runtime/helpers/classCallCheck');
require('tdesign-icons-vue-next');
require('../../checkbox/index.js');
require('../../checkbox/checkbox.js');
require('../../checkbox/props.js');
require('../../_chunks/dep-22864d8c.js');
require('../../_chunks/dep-23e00954.js');
require('../../_chunks/dep-f84f5bb1.js');
require('../../_chunks/dep-14a4602c.js');
require('../../_chunks/dep-550c1f49.js');
require('../../_chunks/dep-b8ff5f63.js');
require('../../_chunks/dep-48fd1561.js');
require('../../_chunks/dep-ba16dbb9.js');
require('../../_chunks/dep-8f150572.js');
require('../../_chunks/dep-4f15f63d.js');
require('../../_chunks/dep-526dfc98.js');
require('../../_chunks/dep-260f2492.js');
require('../../_chunks/dep-8e3b96a6.js');
require('../../_chunks/dep-555f0b0c.js');
require('../../_chunks/dep-69701ddb.js');
require('../../_chunks/dep-5474408c.js');
require('../../_chunks/dep-a3f10d40.js');
require('../../_chunks/dep-41fb79c4.js');
require('../../checkbox/constants/index.js');
require('../../checkbox/hooks/useCheckboxLazyLoad.js');
require('../../_chunks/dep-e570f7b1.js');
require('../../checkbox/hooks/useKeyboardEvent.js');
require('../../_chunks/dep-fb9a2bd2.js');
require('../../checkbox/group.js');
require('../../checkbox/checkbox-group-props.js');
require('../../_chunks/dep-0ac2faad.js');
require('../../_chunks/dep-4b2ba78c.js');
require('../../_chunks/dep-af286901.js');
require('../../_chunks/dep-586bebb7.js');
require('../../_chunks/dep-0dfb856c.js');
require('../../_chunks/dep-d4d6b0ce.js');
require('../../loading/index.js');
require('../../_chunks/dep-c1fe6425.js');
require('../../loading/plugin.js');
require('../../_chunks/dep-20a989b6.js');
require('../../loading/icon/gradient.js');
require('../../_chunks/dep-0a5ee5d1.js');
require('@babel/runtime/helpers/objectWithoutProperties');
require('../../_chunks/dep-f8163869.js');
require('../../_chunks/dep-7e514e61.js');
require('../../loading/props.js');
require('../../_chunks/dep-0f2379ad.js');
require('../../_chunks/dep-a1d79004.js');
require('../../_chunks/dep-f8074d90.js');
require('../../_chunks/dep-d2dcc7ae.js');
require('../../_chunks/dep-fc13d8ec.js');
require('../../_chunks/dep-b361eede.js');
require('../../_chunks/dep-69bb1fda.js');
require('../../_chunks/dep-674dfb17.js');
require('@babel/runtime/helpers/asyncToGenerator');
require('@babel/runtime/regenerator');

function useTreeEvents(state) {
  var treeState = state;
  var props = treeState.props,
    context = treeState.context;
  var _useTreeAction = tree_hooks_useTreeAction["default"](state),
    toggleExpanded = _useTreeAction.toggleExpanded,
    toggleActived = _useTreeAction.toggleActived,
    toggleChecked = _useTreeAction.toggleChecked;
  var handleClick = function handleClick(evtState) {
    var mouseEvent = evtState.mouseEvent,
      event = evtState.event,
      node = evtState.node;
    if (!node || !mouseEvent) return;
    treeState.mouseEvent = mouseEvent;
    var shouldExpand = props.expandOnClickNode;
    var shouldActive = !props.disabled && !node.disabled && node.isActivable();
    var isRightClick = false;
    ["trigger", "ignore"].forEach(function (markName) {
      var mark = tree_utils_index.getMark(markName, event.target, event.currentTarget);
      var markValue = (mark === null || mark === void 0 ? void 0 : mark.value) || "";
      if (markValue.indexOf("expand") >= 0) {
        if (markName === "trigger") {
          shouldExpand = true;
          isRightClick = true;
        } else if (markName === "ignore") {
          shouldExpand = false;
        }
      }
      if (markValue.indexOf("active") >= 0) {
        if (markName === "ignore") {
          shouldActive = false;
        }
      }
    });
    if (shouldExpand) {
      toggleExpanded(node);
      if (isRightClick) return;
    }
    if (shouldActive) {
      toggleActived(node);
    }
    var evtCtx = {
      node: node.getModel(),
      e: mouseEvent
    };
    tree_utils_index.emitEvent(props, context, "click", evtCtx);
    treeState.mouseEvent = null;
  };
  var handleChange = function handleChange(evtState, ctx) {
    var disabled = props.disabled;
    var node = evtState.node;
    if (!node || disabled || node.disabled || !node.isCheckable()) {
      return;
    }
    toggleChecked(node, ctx);
  };
  return {
    handleChange: handleChange,
    handleClick: handleClick
  };
}

exports["default"] = useTreeEvents;
//# sourceMappingURL=useTreeEvents.js.map
