type GoogleSignInResult = {
  type?: string;
  data?: {
    idToken?: string;
  };
};

type GoogleSignInModule = {
  GoogleSignin?: {
    configure: (options: { iosClientId?: string; scopes: string[] }) => void;
    signIn: () => Promise<GoogleSignInResult>;
  };
};

export const GOOGLE_SIGNIN_ERROR_CODES = {
  UNAVAILABLE: 'GOOGLE_SIGNIN_UNAVAILABLE',
  CANCELLED: 'GOOGLE_SIGNIN_CANCELLED',
} as const;

function loadGoogleSignInModule(): GoogleSignInModule | null {
  try {
    return require('@react-native-google-signin/google-signin') as GoogleSignInModule;
  } catch {
    return null;
  }
}

export function configureGoogleSignIn(iosClientId?: string): boolean {
  const module = loadGoogleSignInModule();
  if (!module?.GoogleSignin) {
    return false;
  }

  try {
    module.GoogleSignin.configure({
      iosClientId,
      scopes: ['profile', 'email'],
    });
    return true;
  } catch {
    return false;
  }
}

export async function runGoogleNativeSignIn(): Promise<{ idToken: string }> {
  const module = loadGoogleSignInModule();
  if (!module?.GoogleSignin) {
    const unavailableError: any = new Error(
      'Google Sign-In native module is not available in this build. Use a custom iOS dev build (expo run:ios) or TestFlight/App Store binary.'
    );
    unavailableError.code = GOOGLE_SIGNIN_ERROR_CODES.UNAVAILABLE;
    throw unavailableError;
  }

  let result: GoogleSignInResult;
  try {
    result = await module.GoogleSignin.signIn();
  } catch {
    const unavailableError: any = new Error(
      'Google Sign-In native module is not available in this build. Use a custom iOS dev build (expo run:ios) or TestFlight/App Store binary.'
    );
    unavailableError.code = GOOGLE_SIGNIN_ERROR_CODES.UNAVAILABLE;
    throw unavailableError;
  }

  if (result?.type === 'cancelled') {
    const cancelledError: any = new Error('Google sign-in was cancelled');
    cancelledError.code = GOOGLE_SIGNIN_ERROR_CODES.CANCELLED;
    throw cancelledError;
  }

  const idToken = result?.data?.idToken;
  if (!idToken) {
    throw new Error('Google did not return an ID token');
  }

  return { idToken };
}