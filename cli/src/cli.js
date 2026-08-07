import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';

export function resolverHome({ env, platform, home = homedir() }) {
  if (env.GERONTICARE_HOME) return env.GERONTICARE_HOME;

  if (platform === 'darwin') {
    return posix.join(home, 'Library', 'Application Support', 'GerontiCare');
  }
  if (platform === 'win32') {
    if (!env.LOCALAPPDATA) throw new Error('LOCALAPPDATA não está definido.');
    return win32.join(env.LOCALAPPDATA, 'GerontiCare');
  }
  return posix.join(env.XDG_DATA_HOME || posix.join(home, '.local', 'share'), 'geronticare');
}
