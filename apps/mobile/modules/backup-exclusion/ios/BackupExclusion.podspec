Pod::Spec.new do |s|
  s.name           = 'BackupExclusion'
  s.version        = '1.0.0'
  s.summary        = 'Excludes the account vault from iCloud backup and device transfer'
  s.author         = 'Tableside'
  s.homepage       = 'https://github.com/0xRowdy/tableside'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
