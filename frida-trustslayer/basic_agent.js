/*
Copyright (c) 2018-2019 NCC Group Security Services, Inc. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
SUCH DAMAGE.
*/
function yoloproxy(cfg) {
  if (cfg === undefined) {
    var cfg = {};
  }
  if (cfg !== undefined) {
    if (cfg["proxy"] === undefined) {
      cfg["proxy"] = {};
    }
    if (cfg["proxy"]["host"] === undefined) {
      cfg["proxy"]["host"] = "127.0.0.1";
    }
    if (cfg["proxy"]["port"] === undefined) {
      cfg["proxy"]["port"] = 8080;
    }
  }

  function getProperty1(key) {
    return getProperty2(key, undefined);
  }

  var proxy_host = cfg["proxy"]["host"];
  var proxy_port = "" + cfg["proxy"]["port"];
  function getProperty2(key, def) {
    var vals = {
      'http.proxyHost': proxy_host,
      'https.proxyHost': proxy_host,
      'proxyHost': proxy_host,
      'http.proxyPort': proxy_port,
      'https.proxyPort': proxy_port,
      'proxyPort': proxy_port,
      
    };
    if (vals[key] !== undefined) {
      return vals[key];
    }
    if (def === undefined) {
      return this.getProperty(key);
    } else {
      return this.getProperty(key, def);
    }
  }

  var System = Java.use('java.lang.System');  
  System.getProperty.overload(
    'java.lang.String'
  ).implementation = getProperty1;
  System.getProperty.overload(
    'java.lang.String', 'java.lang.String'
  ).implementation = getProperty2;
}

function okhttp3(cfg) {
  /* This function will override the OkHttpClient constructor to inject a Proxy
     into the built OkHttpClient and forcibly set its CertificatePinner to the
     default blank one. While this can be run through spawn gating, it also
     supports setting up the hooks after the fact, by iterating over all
     OkHttpClient instances to do the same overrides. Lastly, for good measure,
     it overrides the CertificatePinner::check method in case the pinner is
     somehow changed by the app at runtime. This change also ends up negating
     the following used when building n OkHttpClient by default from a builder.
     This is done as it is more complicated to implement this behavior
     after-the-fact.

     ```
     this.certificatePinner = builder
                             .certificatePinner
                             .withCertificateChainCleaner(
                               certificateChainCleaner
                             );
     ```

     Note: As of Android 8.0 "Oreo," Android still uses OkHttp 2.x internally.
  */
  if (cfg === undefined) {
    var cfg = {};
  }
  if (cfg !== undefined) {
    if (cfg["proxy"] === undefined) {
      cfg["proxy"] = {};
    }
    if (cfg["proxy"]["host"] === undefined) {
      cfg["proxy"]["host"] = "127.0.0.1";
    }
    if (cfg["proxy"]["port"] === undefined) {
      cfg["proxy"]["port"] = 8080;
    }
    if (cfg["pkg"] === undefined) {
      cfg["pkg"] = "okhttp3";
    }
    if (cfg["certificatePinnerClass"] === undefined) {
      cfg["certificatePinnerClass"] = "CertificatePinner";
    }
    if (cfg["certificatePinner_DEFAULT"] === undefined) {
      cfg["certificatePinner_DEFAULT"] = "DEFAULT";
    }
    if (cfg["okHttpClientClass"] === undefined) {
      cfg["okHttpClientClass"] = "OkHttpClient";
    }
    if (cfg["okHttpClientBuilderClass"] === undefined) {
      cfg["okHttpClientBuilderClass"] = "OkHttpClient$Builder";
    }
    if (cfg["okHttpClient_certificatePinnerField"] === undefined) {
      cfg["okHttpClient_certificatePinnerField"] = "certificatePinner";
    }
    if (cfg["okHttpClient_proxyField"] === undefined) {
      cfg["okHttpClient_proxyField"] = "proxy";
    }
  }
  if (cfg["certificatePinnerClass"].search('.') != -1) {
    cfg["certificatePinnerClass"] = cfg["pkg"] + '.' + cfg["certificatePinnerClass"];
  }
  if (cfg["okHttpClientClass"].search('.') != -1) {
    cfg["okHttpClientClass"] = cfg["pkg"] + '.' + cfg["okHttpClientClass"];
  }
  if (cfg["okHttpClientBuilderClass"].search('.') != -1) {
    cfg["okHttpClientBuilderClass"] = cfg["pkg"] + '.' + cfg["okHttpClientBuilderClass"];
  }

  var pinnerClass = Java.use(cfg["certificatePinnerClass"]);
  var clientClass = Java.use(cfg["okHttpClientClass"]);
  var ProxyClass = Java.use("java.net.Proxy");
  var ProxyTypeClass = Java.use("java.net.Proxy$Type");
  var InetSocketAddressClass = Java.use("java.net.InetSocketAddress");

  var proxy = ProxyClass.$new(
    ProxyTypeClass.valueOf("HTTP"),
    InetSocketAddressClass.$new(cfg["proxy"]["host"], cfg["proxy"]["port"])
  );
  var defaultPinner = pinnerClass[cfg["certificatePinner_DEFAULT"]].value;

  clientClass.$init.overload(
    cfg["okHttpClientBuilderClass"]
  ).implementation = function(builder) {
    this.$init(builder);
    this[
      cfg["okHttpClient_certificatePinnerField"]
    ].value = defaultPinner;
    this[
      cfg["okHttpClient_proxyField"]
    ].value = proxy;
    return this;
  };

  Java.choose(cfg["okHttpClientClass"], {
    onMatch: function(instance) {
      instance[
        cfg["okHttpClient_certificatePinnerField"]
      ].value = defaultPinner;
      instance[
        cfg["okHttpClient_proxyField"]
      ].value = proxy;
    },
    onComplete: function() {}
  });

  pinnerClass.check.overload(
    'java.lang.String', 'java.util.List'
  ).implementation = function(hostname, peerCertificates) { };
}


function okhttp2(cfg) {
  /* This function will override the OkHttpClient constructor to inject a Proxy
     into the built OkHttpClient and forcibly set its CertificatePinner to the
     default blank one. As OkHttp 2.x has a mutable OkHttpClient class, we disable
     the setters for these. While this can be run through spawn gating, it also
     supports setting up the hooks after the fact, by iterating over all
     OkHttpClient instances to do the same overrides. Lastly, for good measure,
     it overrides the CertificatePinner::check method in case the pinner is
     somehow changed by the app at runtime.

     If an app is trying to bypass the setters via reflection, just run this
     function again to modify the instances or add a custom hook to deal with
     their shenanigans.
  */
  if (cfg === undefined) {
    var cfg = {};
  }
  if (cfg !== undefined) {
    if (cfg["proxy"] === undefined) {
      cfg["proxy"] = {};
    }
    if (cfg["proxy"]["host"] === undefined) {
      cfg["proxy"]["host"] = "127.0.0.1";
    }
    if (cfg["proxy"]["port"] === undefined) {
      cfg["proxy"]["port"] = 8080;
    }
    if (cfg["pkg"] === undefined) {
      cfg["pkg"] = "com.square.okhttp";
    }
    if (cfg["certificatePinnerClass"] === undefined) {
      cfg["certificatePinnerClass"] = "CertificatePinner";
    }
    if (cfg["certificatePinner_DEFAULT"] === undefined) {
      cfg["certificatePinner_DEFAULT"] = "DEFAULT";
    }
    if (cfg["okHttpClientClass"] === undefined) {
      cfg["okHttpClientClass"] = "OkHttpClient";
    }
    if (cfg["okHttpClientBuilderClass"] === undefined) {
      cfg["okHttpClientBuilderClass"] = "OkHttpClient$Builder";
    }
    if (cfg["okHttpClient_certificatePinnerField"] === undefined) {
      cfg["okHttpClient_certificatePinnerField"] = "certificatePinner";
    }
    if (cfg["okHttpClient_proxyField"] === undefined) {
      cfg["okHttpClient_proxyField"] = "proxy";
    }
    if (cfg["okHttpClient_setProxyMethod"] === undefined) {
      cfg["okHttpClient_setProxyMethod"] = "setProxy";
    }
    if (cfg["okHttpClient_setCertificatePinnerMethod"] === undefined) {
      cfg["okHttpClient_setCertificatePinnerMethod"] = "setCertificatePinner";
    }
  }
  if (cfg["certificatePinnerClass"].search('.') != -1) {
    cfg["certificatePinnerClass"] = cfg["pkg"] + '.' + cfg["certificatePinnerClass"];
  }
  if (cfg["okHttpClientClass"].search('.') != -1) {
    cfg["okHttpClientClass"] = cfg["pkg"] + '.' + cfg["okHttpClientClass"];
  }
  if (cfg["okHttpClientBuilderClass"].search('.') != -1) {
    cfg["okHttpClientBuilderClass"] = cfg["pkg"] + '.' + cfg["okHttpClientBuilderClass"];
  }

  var pinnerClass = Java.use(cfg["certificatePinnerClass"]);
  var clientClass = Java.use(cfg["okHttpClientClass"]);
  var ProxyClass = Java.use("java.net.Proxy");
  var ProxyTypeClass = Java.use("java.net.Proxy$Type");
  var InetSocketAddressClass = Java.use("java.net.InetSocketAddress");

  var proxy = ProxyClass.$new(
    ProxyTypeClass.valueOf("HTTP"),
    InetSocketAddressClass.$new(cfg["proxy"]["host"], cfg["proxy"]["port"])
  );
  var defaultPinner = pinnerClass[cfg["certificatePinner_DEFAULT"]].value;

  clientClass.$init.overload().implementation = function() {
    this.$init();
    this[
      cfg["okHttpClient_certificatePinnerField"]
    ].value = defaultPinner;
    this[
      cfg["okHttpClient_proxyField"]
    ].value = proxy;
    return this;
  };
  clientClass.$init.overload(
    cfg["okHttpClientClass"]
  ).implementation = function(client) {
    this.$init(client);
    this[
      cfg["okHttpClient_certificatePinnerField"]
    ].value = defaultPinner;
    this[
      cfg["okHttpClient_proxyField"]
    ].value = proxy;
    return this;
  };

  clientClass[
    cfg["okHttpClient_setProxyMethod"]
  ].implementation = function(_p) {
    this[
      cfg["okHttpClient_proxyField"]
    ].value = proxy;
    return this;
  };
  clientClass[
    cfg["okHttpClient_setCertificatePinnerMethod"]
  ].implementation = function(_cp) {
    ret[
      cfg["okHttpClient_certificatePinnerField"]
    ].value = defaultPinner;
    return this;
  };

  Java.choose(cfg["okHttpClientClass"], {
    onMatch: function(instance) {
      instance[
        cfg["okHttpClient_certificatePinnerField"]
      ].value = defaultPinner;
      instance[
        cfg["okHttpClient_proxyField"]
      ].value = proxy;
    },
    onComplete: function() {}
  });

  pinnerClass.check.overload(
    'java.lang.String', 'java.util.List'
  ).implementation = function(hostname, peerCertificates) { };
}


function deprecatedHttpClient(cfg) {
  /* Unfortunately there are those who still use the deprecated Apache
     HttpClient 4.x library (older, non-builder style) in their Android apps.
     Well, at least it's better than HttpClient 3.x. That was a horror show.

     As a part of Android itself (even if Google tries to pretend like it's not
     in Oreo), this is generally the real one. However, if anyone decides to
     bundle their own proguarded version (or if Google make the gradle dep use
     an actual jar) we need to support setting the pkg/class/method names.
  */
  if (cfg === undefined) {
    var cfg = {};
  }
  if (cfg !== undefined) {
    if (cfg["proxy"] === undefined) {
      cfg["proxy"] = {};
    }
    if (cfg["proxy"]["host"] === undefined) {
      cfg["proxy"]["host"] = "127.0.0.1";
    }
    if (cfg["proxy"]["port"] === undefined) {
      cfg["proxy"]["port"] = 8080;
    }
    if (cfg["abstractHttpClientClass"] === undefined) {
      cfg["abstractHttpClientClass"] = "org.apache.http.impl.client.AbstractHttpClient";
    }
    if (cfg["httpParamsIface"] === undefined) {
      cfg["httpParamsIface"] = "org.apache.http.params.HttpParams";
    }
    if (cfg["httpParamsIface_setParameterMethod"] === undefined) {
      cfg["httpParamsIface_setParameterMethod"] = "setParameter";
    }
    if (cfg["httpParamsIface_getParameterMethod"] === undefined) {
      cfg["httpParamsIface_getParameterMethod"] = "getParameter";
    }
    if (cfg["httpHostClass"] === undefined) {
      cfg["httpHostClass"] = "org.apache.http.HttpHost";
    }
  }

  var proxyClass = Java.use(cfg["httpHostClass"]);
  var proxy = proxyClass.$new(cfg["proxy"]["host"],
                              cfg["proxy"]["port"],
                              "http"
  );

  var HttpParamsIface = Java.use(cfg["httpParamsIface"]);
  var ModifierClass = Java.use("java.lang.reflect.Modifier");
  var ABSTRACT = ModifierClass.ABSTRACT.value;
  var INTERFACE = ModifierClass.INTERFACE.value;
  var DEFAULT_PROXY = "http.route.default-proxy";

  Java.enumerateLoadedClasses({
    onMatch: function(className) {
      try {
        var clazz = Java.use(className);
      } catch (e) {
        return;
      }
      var mods = clazz.class.getModifiers();
      if ((mods & INTERFACE) != 0) {
        return;
      }

      if (HttpParamsIface.class.isAssignableFrom(clazz.class)) {
        try {
          clazz[cfg["httpParamsIface_setParameterMethod"]].overload(
            'java.lang.String', 'java.lang.Object'
          ).implementation = function(name, value) {
            if (name == DEFAULT_PROXY) {
              return this[
                cfg["httpParamsIface_setParameterMethod"]
              ](DEFAULT_PROXY, proxy);
            } else {
              return this[
                cfg["httpParamsIface_setParameterMethod"]
              ](name, value);
            }
          };
        } catch (e) {}
        try {
          clazz[
            cfg["httpParamsIface_getParameterMethod"]
          ].implementation = function(name) {
            //console.log('getParameter("' + name + '"):');
            var ret = this[cfg["httpParamsIface_getParameterMethod"]](name);
            //console.log(ret);
            if (name == DEFAULT_PROXY) {
              //console.log("returning our proxy");
              return proxy;
            }
            return ret;
          };
        } catch (e) {}

        if ((mods & ABSTRACT) == 0) {
          Java.choose(className, {
            onMatch: function(instance) {
              try {
                // our hook should catch this
                instance[
                  cfg["httpParamsIface_setParameterMethod"]
                ](DEFAULT_PROXY, proxy);
              } catch (e) { }
            },
            onComplete: function() {}
          });
        }
      }
    },
    onComplete: function() {}
  });

  var clientClass = Java.use(cfg["abstractHttpClientClass"]);
  clientClass.$init.implementation = function(conman, params) {
    this.$init(conman, params);
    // our hook should catch this
    params[cfg["httpParamsIface_setParameterMethod"]](DEFAULT_PROXY, proxy);
    return this;
  };
}

function volleyTimeoutExtender(cfg) {
  if (cfg === undefined) {
    var cfg = {};
  }
  if (cfg !== undefined) {
    if (cfg["RetryPolicyIface"] === undefined) {
      cfg["RetryPolicyIface"] = "com.android.volley.RetryPolicy";
    }
    if (cfg["RetryPolicyIface_getCurrentTimeout"] === undefined) {
      cfg["RetryPolicyIface_getCurrentTimeout"] = "getCurrentTimeout";
    }
    if (cfg["RetryPolicyIface_getCurrentRetryCount"] === undefined) {
      cfg["RetryPolicyIface_getCurrentRetryCount"] = "getCurrentRetryCount";
    }
  }

  var RetryPolicyIface = Java.use(cfg["RetryPolicyIface"]);
  var ModifierClass = Java.use("java.lang.reflect.Modifier");
  //var ABSTRACT = ModifierClass.ABSTRACT.value;
  var INTERFACE = ModifierClass.INTERFACE.value;

  Java.enumerateLoadedClasses({
    onMatch: function(className) {
      try {
        var clazz = Java.use(className);
      } catch (e) {
        return;
      }
      var mods = clazz.class.getModifiers();
      if ((mods & INTERFACE) != 0) {
        return;
      }

      if (RetryPolicyIface.class.isAssignableFrom(clazz.class)) {
        try {
          clazz[cfg["RetryPolicyIface_getCurrentTimeout"]].implementation = function() {
            return 100000;
          };
          clazz[cfg["RetryPolicyIface_getCurrentRetryCount"]].implementation = function() {
            return 100;
          };
        } catch (e) {}
      }
    },
    onComplete: function() {}
  });
}


function killTrust() {
  var X509TrustManagerIface = Java.use("javax.net.ssl.X509TrustManager");
  var HostnameVerifierIface = Java.use("javax.net.ssl.HostnameVerifier");
  var X509ExtendedTrustManagerClass = null;
  if (parseFloat(Java.androidVersion) >= 7.0) {
    X509ExtendedTrustManagerClass = Java.use(
      "javax.net.ssl.X509ExtendedTrustManager"
    );
  }
  var ModifierClass = Java.use("java.lang.reflect.Modifier");
  var ABSTRACT = ModifierClass.ABSTRACT.value;
  var INTERFACE = ModifierClass.INTERFACE.value;

  Java.enumerateLoadedClasses({
    onMatch: function(className) {
      try {
        var clazz = Java.use(className);
      } catch (e) {
        return;
      }

      var mods = clazz.class.getModifiers();
      if ((mods & INTERFACE) != 0) {
        return;
      }

      if (X509TrustManagerIface.class.isAssignableFrom(clazz.class)) {
        if ((mods & ABSTRACT) != 0) {
          return;
        }
        try {
          // iterating is a hack to get around
          // com.android.org.conscrypt.TrustManagerImpl's nonstandard
          // check*Trusted methods, though this will probably make up for
          // the X509TrustManager/X509ExtendedTrustManager discrepancies
          // across different android versions...
          clazz.checkClientTrusted.overloads.forEach(function(overload) {
            overload.implementation = function() { return null; };
          });
          clazz.checkServerTrusted.overloads.forEach(function(overload) {
            overload.implementation = function() { return null; };
          });
          clazz.getAcceptedIssuers.implementation = function() { return []; };

          /*clazz.checkClientTrusted.overload(
            '[Ljava.security.cert.X509Certificate;', 'java.lang.String'
          ).implementation = function(chain, authType) { };
          clazz.checkServerTrusted.overload(
            '[Ljava.security.cert.X509Certificate;', 'java.lang.String'
          ).implementation = function(chain, authType) { };
          */
          //if (className == "com.android.org.conscrypt.TrustManagerImpl") {
          //  clazz.checkTrustedRecursive.implementation = function(a,b,c,d,e,f){};
          //}
        } catch (e) {
          console.log("failed to hook X509TrustManager methods for: " + className);
        }
      }

      if (HostnameVerifierIface.class.isAssignableFrom(clazz.class)) {
        try {
          // due to frida being anti-polymorphic, we need to find every class
          // that implements HostnameVerifier* and kill each of the verify
          // methods they individually define
          clazz.verify.overloads.forEach(function(overload) {
            try {
              if (overload.returnType.name === "V") {
                overload.implementation = function() { };
              } else if (overload.returnType.name === "Z") {
                overload.implementation = function() {
                  return true;
                };
              } else {
                console.log("????");
              }
            } catch (e) { console.log(e); }
          });
        } catch (e) { console.log(e); }
      }

      /*
      if (X509ExtendedTrustManagerClass != null &&
          X509ExtendedTrustManagerClass.class.isAssignableFrom(clazz.class)) {
        clazz.checkClientTrusted.overload(
          '[Ljava.security.cert.X509Certificate;',
          'java.lang.String', 'java.net.socket'
        ).implementation = function(chain, authType, socket) { };

        clazz.checkClientTrusted.overload(
          '[Ljava.security.cert.X509Certificate;',
          'java.lang.String', 'javax.net.ssl.SSLEngine'
        ).implementation = function(chain, authType, engine) { };

        clazz.checkServerTrusted.overload(
          '[Ljava.security.cert.X509Certificate;',
          'java.lang.String', 'java.net.socket'
        ).implementation = function(chain, authType, socket) { };

        clazz.checkServerTrusted.overload(
          '[Ljava.security.cert.X509Certificate;',
          'java.lang.String', 'javax.net.ssl.SSLEngine'
        ).implementation = function(chain, authType, engine) { };
      }
      */
    },
    onComplete: function() {}
  });
}

function trustslayer(cfg) {
  console.log("slaying all trust");
  Java.perform(function() {
    
    killTrust();
    
    try {
      var _ = JSON.parse(JSON.stringify(cfg));
      yoloproxy(_);
    } catch (e) { console.log(e); }

    try {
      var _ = JSON.parse(JSON.stringify(cfg));
      okhttp3(_);
    } catch (e) { console.log(e); }

    try {
      var _ = JSON.parse(JSON.stringify(cfg));
      okhttp2(_);
    } catch (e) { console.log(e); }

    try {
      var _ = JSON.parse(JSON.stringify(cfg));
      Object.assign(_, { "pkg": "com.android.okhttp" });
      /*if (cfg["proxy"]) {
        _["proxy"] = cfg["proxy"];
      }*/
      okhttp2(_);
      //okhttp2({ "pkg": "com.android.okhttp" });
    } catch (e) { console.log(e); }
    
    try {
      var _ = JSON.parse(JSON.stringify(cfg));
      deprecatedHttpClient(_);
    } catch (e) { console.log(e); }

    try {
      var _ = JSON.parse(JSON.stringify(cfg));
      volleyTimeoutExtender(_);
    } catch (e) { console.log(e); }

  });
}

rpc.exports = {
  'all': function(cfg) {
    Java.perform(function() {
      trustslayer(cfg);
    });
  },
  'killTrust': function() {
    Java.perform(function() {
      killTrust();
    });
  },
  'okhttp3': function(cfg) {
    Java.perform(function() {
      okhttp3(cfg);
    });
  },
  'okhttp2': function(cfg) {
    Java.perform(function() {
      okhttp2(cfg);
    });
  },
  'okhttp2_android': function(cfg) {
    Java.perform(function() {
      var android_cfg = { "pkg": "com.android.okhttp" };
      if (cfg["proxy"]) {
        android_cfg["proxy"] = cfg["proxy"];
      }
      okhttp2(android_cfg);
    });
  },
  'apache4': function(cfg) {
    Java.perform(function() {
      deprecatedHttpClient(cfg);
    });
  },
  'volleyTimeoutExtender': function(cfg) {
    Java.perform(function() {
      volleyTimeoutExtender(cfg);
    });
  },
  'yoloproxy': function(cfg) {
    Java.perform(function() {
      yoloproxy(cfg);
    });
  },
}
