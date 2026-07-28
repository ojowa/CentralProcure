import util from 'node:util';

export const patchUtilExtend = () => {
  if (
    typeof util._extend === 'function' &&
    util._extend !== Object.assign
  ) {
    Object.defineProperty(util, '_extend', {
      value: Object.assign,
      configurable: true,
      writable: true
    });
  }
};
