# Android TrustSlayer

A frida script that kills certificate validation involving the standard Java
APIs, with specific hooks targeting:

* OkHttp3
* OkHttp2 (including the internal Android version implementing
  UrlConnection/Volley)
* Apache HttpClient 4.x (deprecated, but still very much a part of
  Android/Volley)

This also disables all certificate pinning, and configures all HTTP(S) traffic
to go through an HTTP proxy (defaults to `127.0.0.1:8080`, to support
`adb reverse tcp:8080 tcp:8080`, but it otherwise configurable).

# Proguard Support

The hooks are configurable, such that the names of the involved classes can be
reconfigured to match whatever Proguard has renamed them to. It's on you to
figure out the proguarded names though.

# Future Work (prior to release)

* Cleanup using `frida-compile`
* Support HttpClient 3.x
* Identify and support other common HTTP libs
