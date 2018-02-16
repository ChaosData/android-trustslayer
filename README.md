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

# Usage

```
frida-ps -U | grep <pkg>
frida -U <pid> -l trustslayer.js
     ____
    / _  |   Frida 10.6.52 - A world-class dynamic instrumentation toolkit
   | (_| |
    > _  |   Commands:
   /_/ |_|       help      -> Displays the help system
   . . . .       object?   -> Display information about 'object'
   . . . .       exit/quit -> Exit
   . . . .
   . . . .   More info at http://www.frida.re/docs/home/

[LGE Nexus 5X::PID::15051]-> trustslayer()
slaying all trust
undefined
[LGE Nexus 5X::PID::15051]->
```

# Proguard Support

The hooks are configurable, such that the names of the involved classes can be
reconfigured to match whatever Proguard has renamed them to. It's on you to
figure out the proguarded names though.

# Future Work (prior to release)

* Optimize to use one class/instance enumeration pass each
* Cleanup using `frida-compile`
* Support simpler configuration to enable/disable hooks
* Support HttpClient 3.x
* Identify and support other common HTTP libs
