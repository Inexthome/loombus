# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Capacitor Background Runner's native Android JS engine resolves these
# classes from JNI by their fully-qualified names. R8 cannot infer that
# reflective/native reachability, so release minification must preserve both
# the class names and members. Without this, release builds can abort during
# app startup with ClassNotFoundException for
# io.ionic.android_js_engine.NativeWebAPI.
-keep class io.ionic.android_js_engine.** { *; }
-keep class io.ionic.backgroundrunner.** { *; }

# Preserve runtime-visible metadata used by Capacitor/plugin discovery.
-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,AnnotationDefault

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Preserve line information so Play Console and adb release crashes remain
# diagnosable after R8 minification.
-keepattributes SourceFile,LineNumberTable
