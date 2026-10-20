Pod::Spec.new do |s|
  s.name           = 'LargeContentViewer'
  s.version        = '1.0.0'
  s.summary        = 'UILargeContentViewerInteraction for the Tableside tab bar'
  s.author         = 'Tableside'
  s.homepage       = 'https://github.com/0xRowdy/tableside'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
