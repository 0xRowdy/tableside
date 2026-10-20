// The iOS Large Content Viewer is a native view; tests use the plain container.
jest.mock('./modules/large-content-viewer', () => require('./modules/large-content-viewer/src/fallback'));
