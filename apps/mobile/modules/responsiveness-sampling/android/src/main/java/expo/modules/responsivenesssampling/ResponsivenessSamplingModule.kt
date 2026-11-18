package expo.modules.responsivenesssampling

import android.net.Uri
import android.os.Build
import android.os.Process
import android.view.Choreographer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

// Spec 1 Launch gates 5; #121; docs/development.md Responsiveness sampling
class ResponsivenessSamplingModule : Module() {
  private val writes = Any()

  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun exportFile(): File = File(context.getExternalFilesDir(null) ?: context.filesDir, "responsiveness-samples.jsonl")

  override fun definition() = ModuleDefinition {
    Name("ResponsivenessSampling")

    Function("now") { System.nanoTime() / 1_000_000.0 }

    Function("processStart") { Process.getStartUptimeMillis().toDouble() }

    AsyncFunction("nextFrame") { promise: Promise ->
      val choreographer = Choreographer.getInstance()
      choreographer.postFrameCallback {
        choreographer.postFrameCallback { frameTimeNanos -> promise.resolve(frameTimeNanos / 1_000_000.0) }
      }
    }.runOnQueue(Queues.MAIN)

    Function("exportUri") { Uri.fromFile(exportFile()).toString() }

    AsyncFunction("append") { text: String ->
      synchronized(writes) { exportFile().appendText(text) }
    }

    Function("abi") { Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown" }

    Function("build") {
      val info = context.packageManager.getPackageInfo(context.packageName, 0)
      "${info.versionName} (${info.longVersionCode})"
    }
  }
}
