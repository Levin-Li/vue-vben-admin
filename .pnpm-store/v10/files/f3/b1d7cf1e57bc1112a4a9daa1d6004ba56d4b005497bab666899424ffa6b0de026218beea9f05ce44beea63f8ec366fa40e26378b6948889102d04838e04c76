/**
 * tdesign v1.18.2
 * (c) 2026 tdesign
 * @license MIT
 */

import { createVNode } from 'vue';
import 'lodash-es';
import '@babel/runtime/helpers/toConsumableArray';
import '@babel/runtime/helpers/typeof';
import '../../_chunks/dep-53e6346b.js';
import { u as usePrefixClass } from '../../_chunks/dep-8e303224.js';
import { u as useGlobalIcon } from '../../_chunks/dep-20587035.js';
import '@babel/runtime/helpers/slicedToArray';
import '../../_chunks/dep-d05b388b.js';
import '@babel/runtime/helpers/defineProperty';
import { CaretRightSmallIcon } from 'tdesign-icons-vue-next';
import '../../checkbox/index.js';
import { Loading } from '../../loading/index.js';
import '@babel/runtime/helpers/asyncToGenerator';
import '@babel/runtime/helpers/classCallCheck';
import '@babel/runtime/helpers/createClass';
import '@babel/runtime/regenerator';
import { getTNode } from '../utils/index.js';
import '../../_chunks/dep-e12c71fd.js';
import '../../config-provider/hooks/useConfig.js';
import '../../config-provider/utils/context.js';
import '../../_chunks/dep-a6f9a9f8.js';
import 'dayjs';
import '../../checkbox/checkbox.js';
import '../../checkbox/props.js';
import '../../_chunks/dep-8da78633.js';
import '../../_chunks/dep-ef950b92.js';
import '../../_chunks/dep-0b052ff6.js';
import '../../_chunks/dep-8004d9ee.js';
import '../../_chunks/dep-69601fdd.js';
import '../../_chunks/dep-588dad55.js';
import '../../_chunks/dep-23942a2a.js';
import '../../_chunks/dep-aa9108d2.js';
import '../../_chunks/dep-a93989e4.js';
import '../../checkbox/constants/index.js';
import '../../checkbox/hooks/useCheckboxLazyLoad.js';
import '../../_chunks/dep-fd731a39.js';
import '../../checkbox/hooks/useKeyboardEvent.js';
import '../../_chunks/dep-aa89675d.js';
import '../../checkbox/group.js';
import '../../checkbox/checkbox-group-props.js';
import '../../_chunks/dep-5e2572cd.js';
import '../../_chunks/dep-5a065472.js';
import 'tdesign-vue-next/esm/common/style/web/components/checkbox/_index.less';
import '../../loading/directive.js';
import '../../loading/plugin.js';
import '../../_chunks/dep-c255d5cf.js';
import '../../loading/icon/gradient.js';
import '../../_chunks/dep-332d72a8.js';
import '@babel/runtime/helpers/objectWithoutProperties';
import '../../loading/props.js';
import 'tdesign-vue-next/esm/common/style/web/components/loading/_index.less';

function useRenderIcon(state) {
  var classPrefix = usePrefixClass().value;
  var componentName = usePrefixClass("tree").value;
  var getFolderIcon = function getFolderIcon(h) {
    var _useGlobalIcon = useGlobalIcon({
        CaretRightSmallIcon: CaretRightSmallIcon
      }),
      CaretRightSmallIcon$1 = _useGlobalIcon.CaretRightSmallIcon;
    return createVNode(CaretRightSmallIcon$1, null, null);
  };
  var handleMousedown = function handleMousedown(evt) {
    evt.preventDefault();
  };
  var renderIcon = function renderIcon(h) {
    var node = state.node,
      treeScope = state.treeScope;
    var scopedSlots = treeScope.scopedSlots;
    var treeProps = (treeScope === null || treeScope === void 0 ? void 0 : treeScope.treeProps) || {};
    var icon = treeProps.icon;
    var isDefaultIcon = false;
    var iconNode = null;
    if (icon === true) {
      if (scopedSlots !== null && scopedSlots !== void 0 && scopedSlots.icon) {
        iconNode = scopedSlots.icon({
          node: node === null || node === void 0 ? void 0 : node.getModel()
        });
      } else if (!node.vmIsLeaf) {
        isDefaultIcon = true;
        iconNode = getFolderIcon();
        if (node.loading && node.expanded) {
          iconNode = createVNode(Loading, null, null);
        }
      } else {
        iconNode = "";
      }
    } else if (icon) {
      iconNode = getTNode(icon, {
        createElement: h,
        node: node
      });
    }
    var wrapIconNode = createVNode("span", {
      "class": ["".concat(componentName, "__icon"), "".concat(classPrefix, "-folder-icon"), isDefaultIcon ? "".concat(componentName, "__icon--default") : ""],
      "trigger": "expand",
      "ignore": "active",
      "onmousedown": handleMousedown
    }, [iconNode]);
    return wrapIconNode;
  };
  return {
    renderIcon: renderIcon
  };
}

export { useRenderIcon as default };
//# sourceMappingURL=useRenderIcon.js.map
