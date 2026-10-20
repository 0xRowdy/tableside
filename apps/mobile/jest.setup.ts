// The iOS Large Content Viewer is a native view. Tests swap in plain views that
// keep its props (title, systemImage, onSelect) readable, so tests can check
// what the tab bar hands the native interaction and play its lift-to-select.
jest.mock('./modules/large-content-viewer', () => {
  const { createElement } = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    LargeContentContainer: View,
    LargeContentItem: (props: object) => createElement(View, { testID: 'large-content-item', ...props }),
  };
});
