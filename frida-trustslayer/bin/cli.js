#!/usr/bin/env node

const program = require('commander');
const version = require('../package.json').version;
const fs = require('fs');
const frida = require('frida');
const path = require('path');
const { promisify } = require('util')
const pReadFile = promisify(fs.readFile);


let device, platform, target, paused, config, hooks;

main().catch((err)=>{
  console.error(err)
});

async function main() {
  program
    .version(version)
    .usage('[options] <hook type>...')
    .option('-t', '--type [platform]', 'defaults to "android"')
    .option('-s, --spawn [app]', 'spawn app')
    .option('-g, --gate [app]', 'spawn app with spawn gating')
    .option('-p, --pid [pid]', 'attach to pid')
    .option('-x, --proxy [host:port]', 'set http proxy. (127.0.0.1:8080)')
    .option('-r, --remote [host:port]', 'connect to remote frida-server')
    .option('-u, --usb', 'connect to USB device')
    .option('-o, --obfuscated [mapping.json]', 'use deobfuscation mapping')
    .parse(process.argv);

  platform = program.platform || 'android';
  hooks = program.args || ['all'];
  hooks = hooks.length == 0 ? ['all'] : hooks;
  
  config = { }

  if (platform == 'android') {
    if (!!program.spawn + !!program.gate + !!program.pid > 1) {
      console.error("Error: Only one of of --spawn/--gate/--pid may be specified.");
      program.help();
    }
    if (!!program.spawn + !!program.gate + !!program.pid < 1) {
      console.error("Error: One of --spawn/--gate/--pid must be specified.");
      program.help();
    }
    if (!!program.remote + !!program.usb > 1) {
      console.error("Error: Only one of --remote/--usb may be specified.");
      program.help();
    }

    if (!!program.remote + !!program.usb) {
      if (program.gate) {
        console.error("Error: --gate may only be used with a compatible device specified via --usb/--remote.")
        program.help();
      }
    }

    if (program.proxy) {
      if (program.proxy === true) {
        console.error("Error: proxy must be specified for --proxy.");
        program.help();
      }
      let proxy_split = program.proxy.split(':');
      if (proxy_split.length != 2) {
        console.error("Error: Invalid proxy format does not match host:port.");
        program.help();
      }
      let proxy_port = parseInt(proxy_split[1]);
      if (proxy_port < 0 || proxy_port > 65535) {
        console.error("Error: Invalid proxy port");
        program.help();
      }
      config["proxy"] = {
        "host": proxy_split[0],
        "port": proxy_port
      }
    }


    let obfuscated = {};
    /* this format is not actually used (yet)
      {
        'okhttp3': {
          'pkg': 'a.b.c',
          'classes': {
            'CertificatePinner': {
              'name': '...',
              'methods': {},
              'fields': {
               'DEFAULT': '...',
              }
            },
            'OkHttpClient': {
              'name': '...',
              'methods': {
                'check': {
                  'name': '...',
                  'arglist': []
                }
              },
              'fields': {
                'certificatePinner': '...',
                'proxy': '...'
              }
            },
            'OkHttpClient$Builder': {
              'name': '...',
            }
          }
        }
      }
    */
    if (program.obfuscated) {
      try {
        obfuscated = JSON.parse(fs.readFileSync(program.obfuscated, 'utf-8'));
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    }
    config['obfuscated'] = obfuscated;

    if (program.usb) {
      device = await frida.getUsbDevice();
    } else if (program.remote) {
      if (program.remote === true) {
        device = await frida.getRemoteDevice()
      } else {
        let mgr = frida.getDeviceManager();
        device = await mgr.addRemoteDevice(program.remote);
      }
    }

    if (device === null) {
      device = frida;
    }

    if (program.spawn && program.spawn !== true) {
      target = program.spawn;
      paused = true;
      let pid;
      try {
        pid = await device.spawn([target]);
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
      await handle_pid(pid);
      await device.resume(pid);
    } else if (program.gate && program.gate !== true) {
      target = program.gate;
      try {
        device.events.listen('spawned', on_spawned);
        await device.enableSpawnGating();
        console.log('Waiting for process ' + target + ' to be started.');
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    } else if (program.pid && program.pid !== true) {
      paused = false;
      if (program.pid === true) {
        console.error("Error: pid must be specified for --pid.");
        program.help();
      }
      let pid = parseInt(program.pid);
      if (isNaN(pid) || pid < 0) {
        console.error("Error: Invalid --pid");
        program.help();
      } else if (pid === 0 && program.pid != "0") {
        console.error("Error: Possible error with provided --pid of 0.");
        program.help();
      }
      handle_pid(pid);
    } 
  }
}

async function on_spawned(spawn) {
  if (spawn.identifier === target) {
    await device.disableSpawnGating();
    paused = true;
    await handle_pid(spawn.pid);
  }
  await device.resume(spawn.pid);
}

async function profile_device(session) {
  const script = await session.createScript(`
    var is_android = false;
    Process.enumerateModules({
      onMatch: function(mod) {
        if (mod.name === "libandroid_runtime.so"
            && mod.path.startsWith("/system")) {
          is_android = true;
          return "stop";
        }
      },
      onComplete: function() {}
    });
    send({
      'platform': Process.platform,
      'has_java': Java.available,
      'is_android': is_android
    });
  `);
  //console.log(script);
  //console.log(script.events);
  //console.log(script.message);
  /*
  let p = new Promise((res,rej)=>{
    script.events.listen('message', (message, data) => {
      if (message.type == "send") {
        res(message.payload);
      }
    });
  });
  */
  let p = new Promise((res,rej)=>{
    script.message.connect(message => {
      if (message.type == "send") {
        res(message.payload);
      }
    });
  });

  await script.load();
  let profile = await p;
  await script.unload();
  return profile;
}

function validate_profile(profile) {
  if (platform === "android") {
    if (!profile.is_android || !profile.has_java) {
      console.error("Error: Connected device is not Android.");
      process.exit(1);
    }
  }
}

async function load_agent(session) {
  const agent_path = path.join(__dirname, '../basic_agent.js');
  const agent_code = await pReadFile(agent_path, 'utf-8');
  const script = await session.createScript(agent_code);
  await script.load();
  return script;
}

async function handle_pid(pid) {
  let session;
  try {
    session = await device.attach(pid);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
  let profile = await profile_device(session);
  validate_profile(profile);
  const agent_script = await load_agent(session);
  //const TrustSlayer = await agent_script.getExports();
  const TrustSlayer = await agent_script.exports;
  console.log(TrustSlayer);
  for (var h of hooks) {
    console.log('Running hook "' + h + '"');
    try {
      await TrustSlayer[h](config);
    } catch (err) {
      console.error(err);
    }
  }
  console.log("Finished configuring hooks!");
  console.log("Leave this command running until you want to unload the hooks.");
  process.stdin.resume();
}
