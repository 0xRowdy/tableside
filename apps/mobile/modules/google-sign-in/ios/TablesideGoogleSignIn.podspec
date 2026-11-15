Pod::Spec.new do |s|
  s.name           = 'TablesideGoogleSignIn'
  s.version        = '1.0.0'
  s.summary        = 'Native Sign in with Google with a nonce'
  s.author         = 'Tableside'
  s.homepage       = 'https://github.com/0xRowdy/tableside'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  # 7.1 added the nonce to signIn.
  s.dependency 'GoogleSignIn', '~> 9.0'
  s.source_files = '**/*.swift'
end
