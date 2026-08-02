# JazzTree for Android

The Android app is a small, permission-free native shell around JazzTree's
canonical responsive web experience. It packages the entire guide, D3, and both
languages inside the APK, serves them from a safe local HTTPS-like origin, and
opens streaming searches in the user's installed apps or browser.

It supports Android 8.0 (API 26) and newer. The app requests no Internet or other
runtime permission; only an external streaming search leaves the app, through the
phone's chosen browser or music service.

System Back closes the current detail/popover first, then walks backward through
JazzTree's tabs before leaving the app. NetEase searches target the installed
NetEase Cloud Music app directly, then try Android's standard app-search action
and claimed web link before using the browser as a final fallback.

## Build

Install Node.js, JDK 17, and Android SDK Platform 36 / Build Tools 36.0.0. Point
`JAVA_HOME` and `ANDROID_SDK_ROOT` at those installations, then run:

```bash
cd android
./gradlew assembleDebug
```

The installable APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

The build first regenerates and validates the complete Simplified Chinese locale,
then copies an explicit allowlist of web assets into the APK. Android therefore
cannot silently drift from the web version. The debug APK is signed with Android's
standard development key and can be installed directly; a public release needs a
private signing key. Google Play distribution uses `./gradlew bundleRelease` and
produces an AAB after release signing is configured.

To install from a connected development machine:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Or copy the APK to the phone, open it, and allow installation from that file app
when Android asks. That permission can be turned off again after installation.
