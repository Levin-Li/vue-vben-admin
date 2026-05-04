declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): {
    render: (node: any) => void;
    unmount: () => void;
  };
}
