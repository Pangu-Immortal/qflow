const windowsProcessCreation = ["PATHEXT", "SYSTEMROOT", "WINDIR", "ComSpec"] as const;

/**
 * ffmpeg and ffprobe are started as PATH executables. The Host environment is
 * not forwarded, so credential values stay out of those processes. Windows still
 * needs the process-creation variables CreateProcess uses to resolve `.exe`.
 */
export function mediaProcessEnv(
  extra?: Readonly<Record<string, string>>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? "" };
  if (process.platform === "win32") {
    for (const name of windowsProcessCreation) {
      const value = process.env[name];
      if (value !== undefined && value.length > 0) env[name] = value;
    }
  }
  if (extra !== undefined) Object.assign(env, extra);
  return env;
}
