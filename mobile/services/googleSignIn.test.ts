describe('googleSignIn service', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('returns unavailable when native module is missing', async () => {
    jest.doMock('@react-native-google-signin/google-signin', () => ({}), { virtual: true });

    const {
      configureGoogleSignIn,
      runGoogleNativeSignIn,
      GOOGLE_SIGNIN_ERROR_CODES,
    } = require('./googleSignIn');

    expect(configureGoogleSignIn('client-id')).toBe(false);
    await expect(runGoogleNativeSignIn()).rejects.toMatchObject({
      code: GOOGLE_SIGNIN_ERROR_CODES.UNAVAILABLE,
    });
  });

  test('maps user cancellation to app cancellation error code', async () => {
    const signIn = jest.fn().mockResolvedValue({ type: 'cancelled' });
    jest.doMock(
      '@react-native-google-signin/google-signin',
      () => ({
        GoogleSignin: {
          configure: jest.fn(),
          signIn,
        },
      }),
      { virtual: true }
    );

    const { runGoogleNativeSignIn, GOOGLE_SIGNIN_ERROR_CODES } = require('./googleSignIn');

    await expect(runGoogleNativeSignIn()).rejects.toMatchObject({
      code: GOOGLE_SIGNIN_ERROR_CODES.CANCELLED,
    });
  });

  test('treats configure invariant as unavailable and does not crash', () => {
    const configure = jest.fn(() => {
      throw new Error("TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found");
    });

    jest.doMock(
      '@react-native-google-signin/google-signin',
      () => ({
        GoogleSignin: {
          configure,
          signIn: jest.fn(),
        },
      }),
      { virtual: true }
    );

    const { configureGoogleSignIn } = require('./googleSignIn');

    expect(configureGoogleSignIn('ios-client-id')).toBe(false);
  });

  test('maps signIn invariant to unavailable error code', async () => {
    const signIn = jest.fn(() => {
      throw new Error("TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found");
    });

    jest.doMock(
      '@react-native-google-signin/google-signin',
      () => ({
        GoogleSignin: {
          configure: jest.fn(),
          signIn,
        },
      }),
      { virtual: true }
    );

    const { runGoogleNativeSignIn, GOOGLE_SIGNIN_ERROR_CODES } = require('./googleSignIn');

    await expect(runGoogleNativeSignIn()).rejects.toMatchObject({
      code: GOOGLE_SIGNIN_ERROR_CODES.UNAVAILABLE,
    });
  });

  test('returns id token on successful sign-in', async () => {
    const configure = jest.fn();
    const signIn = jest.fn().mockResolvedValue({
      type: 'success',
      data: { idToken: 'id-token-123' },
    });

    jest.doMock(
      '@react-native-google-signin/google-signin',
      () => ({
        GoogleSignin: {
          configure,
          signIn,
        },
      }),
      { virtual: true }
    );

    const { configureGoogleSignIn, runGoogleNativeSignIn } = require('./googleSignIn');

    expect(configureGoogleSignIn('ios-client-id')).toBe(true);
    await expect(runGoogleNativeSignIn()).resolves.toEqual({ idToken: 'id-token-123' });
    expect(configure).toHaveBeenCalledWith({
      iosClientId: 'ios-client-id',
      scopes: ['profile', 'email'],
    });
  });
});