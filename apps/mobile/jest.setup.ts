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

// Audio, haptics and files are native. App tests run the feedback service on
// recording ports instead: `jest.requireMock('@/feedback/device-ports')` holds
// the set the app created most recently (`latest`) and the preferences already
// on the device at the next launch (`stored`).
jest.mock('@/feedback/device-ports', () => {
  const { substituteFeedbackPorts } = jest.requireActual('@/feedback/testing/substitutes') as typeof import('@/feedback/testing/substitutes');
  const mock = {
    latest: null as ReturnType<typeof substituteFeedbackPorts> | null,
    stored: null as string | null,
    createDevicePorts: () => (mock.latest = substituteFeedbackPorts(mock.stored)),
  };
  return mock;
});

// The setup preferences file is native too. `jest.requireMock('@/play/setup/device-storage')`
// holds the storage the app created most recently (`latest`) and what is already on
// the device at the next launch (`stored`).
jest.mock('@/play/setup/device-storage', () => {
  const { MemorySettingsStorage } = jest.requireActual('@/feedback/testing/substitutes') as typeof import('@/feedback/testing/substitutes');
  const mock = {
    latest: null as InstanceType<typeof MemorySettingsStorage> | null,
    stored: null as string | null,
    createSetupStorage: () => (mock.latest = new MemorySettingsStorage(mock.stored)),
  };
  return mock;
});
