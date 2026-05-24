# Classification Analyzer — iOS

Native iOS port. Targets iOS 18.0+; Liquid Glass on iOS 26.

See `../IOS_PLAN.md` for the full plan and milestone breakdown.

## First-time setup

The `.xcodeproj` is generated from `project.yml` by [XcodeGen](https://github.com/yonaskolb/XcodeGen) and is gitignored.

```sh
brew install xcodegen
cd ios
xcodegen generate
open ClassificationAnalyzer.xcodeproj
```

After cloning or pulling, re-run `xcodegen generate` whenever `project.yml`, the Swift package list, or the file structure changes.

## Layout

```
ios/
├── project.yml                    # XcodeGen source of truth
├── Configs/                       # Debug/Release xcconfigs
├── ClassificationAnalyzer/        # App target sources
│   ├── App/                       # @main App, AppModel
│   └── Features/                  # SwiftUI views per screen/component
└── Packages/                      # Local SPM packages
    ├── USPSADomain/               # Types only (Division, ShooterRecord, etc.)
    ├── USPSARules/                # Best-6-of-8, projection — port of src/lib/rules.ts (M2)
    ├── USPSAPasteParser/          # Port of src/lib/textParser.ts (M3)
    └── USPSAClient/               # URLSession proxy client + error mapping
```

## Backend

The app calls the existing Vercel function at `https://classification.rmshooting.com/api/classification?member=<id>`. Base URL is hardcoded in `AppModel.init()` for both Debug and Release builds — point it elsewhere if you need to test against a preview deployment or a local `pnpm dev:api`.

## Testing

```sh
# Each SPM package independently
cd Packages/USPSADomain && swift test
cd Packages/USPSAClient && swift test

# Full app build via Xcode or:
xcodebuild build \
  -project ClassificationAnalyzer.xcodeproj \
  -scheme ClassificationAnalyzer \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=latest' \
  CODE_SIGNING_ALLOWED=NO
```

CI runs the same on every push that touches `ios/**`.

## Signing

`DEVELOPMENT_TEAM` is left blank in `project.yml`. The first time you open the project in Xcode, set your team under **Signing & Capabilities** → "Automatically manage signing" → select your Apple Developer team.
