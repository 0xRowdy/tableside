import ExpoModulesCore
import UIKit

public class LargeContentContainerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LargeContentContainer")
    View(LargeContentContainerView.self) {}
  }
}

public class LargeContentItemModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LargeContentItem")
    View(LargeContentItemView.self) {
      Events("onSelect")
      Prop("title") { (view: LargeContentItemView, title: String) in
        view.largeContentTitle = title
      }
      Prop("systemImage") { (view: LargeContentItemView, name: String?) in
        view.largeContentImage = name.flatMap { UIImage(systemName: $0) }
      }
    }
  }
}

/// Hosts the interaction. The system enables it only at accessibility text sizes.
final class LargeContentContainerView: ExpoView, UILargeContentViewerInteractionDelegate {
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    addInteraction(UILargeContentViewerInteraction(delegate: self))
  }

  func largeContentViewerInteraction(
    _ interaction: UILargeContentViewerInteraction, itemAt point: CGPoint
  ) -> UILargeContentViewerItem? {
    items(in: self).first { item in
      item.bounds.contains(item.convert(point, from: self))
    }
  }

  func largeContentViewerInteraction(
    _ interaction: UILargeContentViewerInteraction, didEndOn item: UILargeContentViewerItem?, at point: CGPoint
  ) {
    (item as? LargeContentItemView)?.onSelect()
  }

  private func items(in view: UIView) -> [LargeContentItemView] {
    view.subviews.flatMap { subview -> [LargeContentItemView] in
      if subview.isHidden { return [] }
      if let item = subview as? LargeContentItemView { return [item] }
      return items(in: subview)
    }
  }
}

final class LargeContentItemView: ExpoView {
  let onSelect = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    showsLargeContentViewer = true
    scalesLargeContentImage = true
  }
}
