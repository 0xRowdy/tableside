import Darwin
import ExpoModulesCore
import QuartzCore

// Spec 1 Launch gates 5; #121; docs/development.md Responsiveness sampling
public class ResponsivenessSamplingModule: Module {
  private let writes = DispatchQueue(label: "com.tableside.responsiveness-sampling.writes")

  public func definition() -> ModuleDefinition {
    Name("ResponsivenessSampling")

    Function("now") { () -> Double in
      CACurrentMediaTime() * 1000
    }

    Function("processStart") { () -> Double? in
      // docs/development.md Responsiveness sampling (cold launch)
      if ProcessInfo.processInfo.environment["ActivePrewarm"] == "1" { return nil }
      var info = kinfo_proc()
      var size = MemoryLayout<kinfo_proc>.stride
      var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
      guard sysctl(&mib, u_int(mib.count), &info, &size, nil, 0) == 0 else { return nil }
      let started = info.kp_proc.p_starttime
      let startedWall = Double(started.tv_sec) * 1000 + Double(started.tv_usec) / 1000
      let nowWall = Date().timeIntervalSince1970 * 1000
      return CACurrentMediaTime() * 1000 - (nowWall - startedWall)
    }

    AsyncFunction("nextFrame") { (promise: Promise) in
      FrameWaiter.wait { promise.resolve($0) }
    }.runOnQueue(.main)

    Function("exportUri") { () -> String in
      Self.exportUrl().absoluteString
    }

    AsyncFunction("append") { (text: String) in
      let url = Self.exportUrl()
      if !FileManager.default.fileExists(atPath: url.path) {
        FileManager.default.createFile(atPath: url.path, contents: nil)
      }
      let handle = try FileHandle(forWritingTo: url)
      defer { try? handle.close() }
      try handle.seekToEnd()
      try handle.write(contentsOf: Data(text.utf8))
    }.runOnQueue(writes)

    Function("abi") { () -> String in
      #if arch(arm64)
        return "arm64"
      #elseif arch(x86_64)
        return "x86_64"
      #else
        return "unknown"
      #endif
    }

    Function("build") { () -> String in
      let info = Bundle.main.infoDictionary
      let version = info?["CFBundleShortVersionString"] as? String ?? "?"
      let number = info?["CFBundleVersion"] as? String ?? "?"
      return "\(version) (\(number))"
    }
  }

  private static func exportUrl() -> URL {
    FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("responsiveness-samples.jsonl")
  }
}

private final class FrameWaiter: NSObject {
  private let done: (Double) -> Void

  private init(done: @escaping (Double) -> Void) {
    self.done = done
  }

  static func wait(_ done: @escaping (Double) -> Void) {
    let link = CADisplayLink(target: FrameWaiter(done: done), selector: #selector(tick(_:)))
    link.add(to: .main, forMode: .common)
  }

  @objc private func tick(_ link: CADisplayLink) {
    link.invalidate()
    done(link.targetTimestamp * 1000)
  }
}
