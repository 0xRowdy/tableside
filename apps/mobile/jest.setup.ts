jest.mock('./modules/large-content-viewer', () => {
  const { createElement } = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    LargeContentContainer: View,
    LargeContentItem: (props: object) => createElement(View, { testID: 'large-content-item', ...props }),
  };
});

jest.mock('@/feedback/device-ports', () => {
  const { substituteFeedbackPorts } = jest.requireActual('@/feedback/testing/substitutes') as typeof import('@/feedback/testing/substitutes');
  const mock = {
    latest: null as ReturnType<typeof substituteFeedbackPorts> | null,
    stored: null as string | null,
    createDevicePorts: () => (mock.latest = substituteFeedbackPorts(mock.stored)),
  };
  return mock;
});

jest.mock('@/play/setup/device-storage', () => {
  const { MemorySettingsStorage } = jest.requireActual('@/feedback/testing/substitutes') as typeof import('@/feedback/testing/substitutes');
  const mock = {
    latest: null as InstanceType<typeof MemorySettingsStorage> | null,
    stored: null as string | null,
    createSetupStorage: () => (mock.latest = new MemorySettingsStorage(mock.stored)),
  };
  return mock;
});

jest.mock('@/theme/device-storage', () => {
  const { MemorySettingsStorage } = jest.requireActual('@/feedback/testing/substitutes') as typeof import('@/feedback/testing/substitutes');
  const mock = {
    latest: null as InstanceType<typeof MemorySettingsStorage> | null,
    stored: '{"step":"standard"}' as string | null,
    createTextSizeStorage: () => (mock.latest = new MemorySettingsStorage(mock.stored)),
  };
  return mock;
});

jest.mock('@/account/app-account', () => {
  const { fakeAppAccount, SIGNED_IN } = jest.requireActual('@/account/testing/fake-account') as typeof import('@/account/testing/fake-account');
  const launch: Required<Parameters<typeof fakeAppAccount>[0]> = { stored: SIGNED_IN, offlineGame: 'blackjack' };
  const mock = {
    latest: null as ReturnType<typeof fakeAppAccount> | null,
    ...launch,
    createAppAccount: () => (mock.latest = fakeAppAccount({ stored: mock.stored, offlineGame: mock.offlineGame })),
  };
  return mock;
});
