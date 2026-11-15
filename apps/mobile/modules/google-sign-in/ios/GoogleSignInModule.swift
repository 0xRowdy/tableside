import ExpoModulesCore
import GoogleSignIn

/// Sign in with Google, returning only the ID token. Its nonce claim is the
/// nonce the app passed (the hash of the nonce it later gives Auth).
public class GoogleSignInModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TablesideGoogleSignIn")

    AsyncFunction("signIn") { (clientId: String, serverClientId: String, nonce: String, promise: Promise) in
      guard let presenting = self.appContext?.utilities?.currentViewController() else {
        promise.resolve(["status": "failed"])
        return
      }
      GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientId, serverClientID: serverClientId)
      GIDSignIn.sharedInstance.signIn(withPresenting: presenting, hint: nil, additionalScopes: nil, nonce: nonce) { result, error in
        if let error = error {
          let canceled = (error as? GIDSignInError)?.code == .canceled
          promise.resolve(["status": canceled ? "canceled" : "failed"])
          return
        }
        guard let token = result?.user.idToken?.tokenString else {
          promise.resolve(["status": "failed"])
          return
        }
        promise.resolve(["status": "token", "idToken": token])
      }
    }.runOnQueue(.main)
  }
}

/// Hands Google's redirect back to GoogleSignIn.
public class GoogleSignInAppDelegate: ExpoAppDelegateSubscriber {
  public func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return GIDSignIn.sharedInstance.handle(url)
  }
}
