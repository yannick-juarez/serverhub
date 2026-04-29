import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Liste les services systemd avec leur état. */
export async function listServices(): Promise<
  { name: string; status: string; description: string; active: string }[]
> {
  const { stdout } = await execFileAsync('systemctl', [
    'list-units',
    '--type=service',
    '--no-pager',
    '--output=json',
  ]);

  const units: {
    unit: string;
    load: string;
    active: string;
    sub: string;
    description: string;
  }[] = JSON.parse(stdout);

  return units.map((u) => ({
    name: u.unit.replace(/\.service$/, ''),
    status: u.sub,
    active: u.active,
    description: u.description,
  }));
}

/** Démarre / arrête / redémarre un service systemd. */
export async function controlService(
  name: string,
  action: 'start' | 'stop' | 'restart' | 'reload',
): Promise<string> {
  // Validation stricte du nom (alphanum, tiret, underscore uniquement)
  if (!/^[\w.-]+$/.test(name)) throw new Error('Invalid service name');
  const allowedActions = ['start', 'stop', 'restart', 'reload'] as const;
  if (!allowedActions.includes(action)) throw new Error('Invalid action');

  await execFileAsync('systemctl', [action, `${name}.service`]);
  return `Service ${name} ${action}ed`;
}

/** Retourne le statut détaillé d'un service. */
export async function getServiceStatus(name: string): Promise<string> {
  if (!/^[\w.-]+$/.test(name)) throw new Error('Invalid service name');
  const { stdout } = await execFileAsync('systemctl', ['status', `${name}.service`, '--no-pager']).catch(
    (e: { stdout: string }) => ({ stdout: e.stdout }),
  );
  return stdout;
}
