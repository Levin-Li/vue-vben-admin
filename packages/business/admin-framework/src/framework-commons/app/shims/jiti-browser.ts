function createUnavailableJiti() {
  return () => {
    throw new Error('jiti is a Node-only loader and is not available in browser runtime.');
  };
}

export const createJiti = createUnavailableJiti;
export const version = 'browser-shim';

export default createUnavailableJiti;
