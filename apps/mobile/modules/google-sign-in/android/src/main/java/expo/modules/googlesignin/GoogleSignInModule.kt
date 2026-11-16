package expo.modules.googlesignin

import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Sign in with Google through Credential Manager, returning only the ID
 * token. Its nonce claim is the nonce the app passed (the hash of the nonce it
 * later gives Auth). The iOS client ID is unused here.
 */
class GoogleSignInModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TablesideGoogleSignIn")

    AsyncFunction("signIn") Coroutine { _: String, serverClientId: String, nonce: String ->
      val activity = appContext.currentActivity ?: return@Coroutine mapOf("status" to "failed")
      val option = GetSignInWithGoogleOption.Builder(serverClientId).setNonce(nonce).build()
      val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
      try {
        val credential = CredentialManager.create(activity).getCredential(activity, request).credential
        if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
          mapOf("status" to "token", "idToken" to GoogleIdTokenCredential.createFrom(credential.data).idToken)
        } else {
          mapOf("status" to "failed")
        }
      } catch (_: GetCredentialCancellationException) {
        mapOf("status" to "canceled")
      } catch (_: GetCredentialException) {
        mapOf("status" to "failed")
      }
    }
  }
}
