import ExpoModulesCore
import Foundation

/// Marks a directory excluded from iCloud backup and device transfer
/// (NSURLIsExcludedFromBackupKey). On a directory the mark covers everything
/// inside it, including files SQLite creates later (WAL and shared memory).
public class BackupExclusionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BackupExclusion")

    AsyncFunction("excludeFromBackup") { (uri: String) in
      guard var url = URL(string: uri), url.isFileURL else {
        throw Exception(name: "InvalidFileUri", description: "Not a file URI: \(uri)")
      }
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
      // Read it back: a mark that didn't stick must not pass silently.
      let check = try url.resourceValues(forKeys: [.isExcludedFromBackupKey])
      if check.isExcludedFromBackup != true {
        throw Exception(name: "NotExcluded", description: "The backup exclusion did not hold for \(uri)")
      }
    }
  }
}
