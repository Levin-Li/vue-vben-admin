/**
 * tdesign v1.18.2
 * (c) 2026 tdesign
 * @license MIT
 */

import { isObject } from 'lodash-es';
import { d as dayjs } from '../../_chunks/dep-b643f39a.mjs';
import { b as isEnabledDate } from '../../_chunks/dep-eee73c31.mjs';
import '../../_chunks/dep-18533aaa.mjs';
import '../../_chunks/dep-c982acb9.mjs';
import '../../_chunks/dep-9ae4ff58.mjs';
import '../../_chunks/dep-fa00df7a.mjs';
import '../../_chunks/dep-fb621581.mjs';
import '../../_chunks/dep-598dbb7e.mjs';
import '../../_chunks/dep-282ec6a1.mjs';
import '../../_chunks/dep-51a193a2.mjs';
import '../../_chunks/dep-ead49380.mjs';
import '../../_chunks/dep-7a6f5a6f.mjs';

function useDisableDate(props) {
  var _disableDate = props.disableDate,
    format = props.format,
    mode = props.mode,
    start = props.start,
    end = props.end;
  return {
    disableDate: function disableDate(value) {
      return !isEnabledDate({
        disableDate: _disableDate,
        format: format,
        mode: mode,
        value: value
      });
    },
    minDate: isObject(_disableDate) && "before" in _disableDate ? new Date(dayjs(_disableDate.before).startOf("day").format()) : start,
    maxDate: isObject(_disableDate) && "after" in _disableDate ? new Date(dayjs(_disableDate.after).endOf("day").format()) : end
  };
}

export { useDisableDate };
//# sourceMappingURL=useDisableDate.mjs.map
