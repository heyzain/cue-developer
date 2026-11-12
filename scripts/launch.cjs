/* Cue Windows launcher: attached process + persistent diagnostic log. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const LOG = path.join(ROOT, 'cue-launch.log');
const CMD = process.env.ComSpec || 'cmd.exe';
const EXE = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const CLI = path.join(ROOT, 'node_modules', 'electron', 'cli.js');

// One log per run: the previous failure is not mixed with the current one.
fs.writeFileSync(LOG,
  `Cue launch ${new Date().toISOString()}\nFolder: ${ROOT}\nWindows: ${process.platform} ${process.arch}\nNode: ${process.version}\n\n`,
  'utf8');

function output(value, stream = process.stdout) {
  const message = String(value);
  stream.write(message);
  try { fs.appendFileSync(LOG, message, 'utf8'); }
  catch (e) { process.stderr.write(`Could not write launcher log: ${e.message}\n`); }
}
function info(message) { output(`[Cue] ${message}\n`); }
function run(command, args, label) {
  return new Promise((resolve, reject) => {
    info(label);
    const started = Date.now();
    const child = spawn(command, args, {
      cwd: ROOT, windowsHide: false,
      env: {...process.env, CUE_LAUNCH_LOG: LOG},
      stdio: ['inherit', 'pipe', 'pipe']
    });
    let done = false;
    child.stdout?.on('data', d => output(d.toString()));
    child.stderr?.on('data', d => output(d.toString(), process.stderr));
    child.once('error', e => { if (!done) { done = true; reject(e); } });
    child.once('close', (code, signal) => {
      if (!done) { done = true; resolve({code: code ?? 1, signal, ms: Date.now()-started}); }
    });
  });
}
function check(result, step) {
  if (result.code !== 0) throw new Error(`${step} failed with exit code ${result.code}.`);
}
async function main() {
  if (process.platform !== 'win32') {
    throw new Error('Use run-windows.cmd on Windows. For macOS/Linux use npm start.');
  }
  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'electron', 'package.json')) || !fs.existsSync(CLI)) {
    check(await run(CMD, ['/d', '/s', '/c', 'npm install --no-fund'], 'Installing dependencies...'), 'npm install');
  }
  if (!fs.existsSync(CLI)) throw new Error('Electron CLI is missing after npm install.');
  if (!fs.existsSync(EXE)) {
    const installJs = path.join(ROOT, 'node_modules', 'electron', 'install.js');
    if (!fs.existsSync(installJs)) {
      throw new Error('Electron installer is missing. Delete node_modules and run again to reinstall dependencies.');
    }
    info('Electron runtime is missing. Downloading it using Electron\'s bundled installer...');
    check(await run(process.execPath, [installJs], 'Running Electron runtime installer...'), 'Electron runtime download');
  }
  if (!fs.existsSync(EXE)) {
    throw new Error('Electron executable is still missing. Download may be blocked by Windows Security, proxy, or network.');
  }
  info('Starting Cue now. The terminal remains attached while Cue runs.');
  info('If Cue opens, you can minimize this terminal. Keep Cue available via taskbar or tray.');
  // Run the supported Electron CLI, not start.exe. start.exe would hide early failures.
  const result = await run(process.execPath, [CLI, '.'], 'Launching Electron...');
  if (result.code !== 0) {
    throw new Error(`Cue exited with code ${result.code}. Look above for the cause.`);
  }
  // A second instance can legitimately quit quickly; make it obvious to the user.
  if (result.ms < 4000) {
    info('Cue exited unusually quickly. Check for an existing Cue tray icon in the Windows ^ menu.');
    info('If no Cue window is visible, send cue-launch.log for a precise diagnosis.');
    return 2;
  }
  info('Cue closed normally.');
  return 0;
}
main().then(code => { process.exitCode = code; }).catch(e => {
  output(`\n[Cue] STARTUP ERROR: ${e.stack || e.message}\n`, process.stderr);
  info(`Diagnostics saved: ${LOG}`);
  process.exitCode = 1;
});
