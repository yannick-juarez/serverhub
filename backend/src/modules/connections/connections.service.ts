import { randomUUID } from 'crypto';
import { readStorage, updateStorage, type StoredDbConnection, type StoredSshConnection } from '../storage/storage.service';

export type PublicDbConnection = Omit<StoredDbConnection, 'password'>;

export type ConnectionsResponse = {
  db: PublicDbConnection[];
  ssh: StoredSshConnection[];
};

function redactDbPassword(item: StoredDbConnection): PublicDbConnection {
  const { password: _password, ...rest } = item;
  return rest;
}

export async function listConnections(): Promise<ConnectionsResponse> {
  const storage = await readStorage();
  return {
    db: storage.connections.db.map(redactDbPassword),
    ssh: storage.connections.ssh,
  };
}

export async function getDbConnectionById(dbId: string): Promise<StoredDbConnection | null> {
  const storage = await readStorage();
  return storage.connections.db.find((item) => item.db_id === dbId) ?? null;
}

export async function createDbConnection(
  payload: Omit<StoredDbConnection, 'db_id' | 'created_at' | 'updated_at'>,
): Promise<PublicDbConnection> {
  const now = new Date().toISOString();

  const created: StoredDbConnection = {
    db_id: randomUUID(),
    created_at: now,
    updated_at: now,
    ...payload,
  };

  await updateStorage((current) => ({
    ...current,
    connections: {
      ...current.connections,
      db: [...current.connections.db, created],
    },
  }));

  return redactDbPassword(created);
}

export async function updateDbConnection(
  dbId: string,
  patch: Partial<Omit<StoredDbConnection, 'db_id' | 'created_at' | 'updated_at'>>,
): Promise<PublicDbConnection> {
  let updated: StoredDbConnection | null = null;

  await updateStorage((current) => {
    const db = current.connections.db.map((item) => {
      if (item.db_id !== dbId) return item;
      updated = {
        ...item,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      return updated;
    });

    return {
      ...current,
      connections: {
        ...current.connections,
        db,
      },
    };
  });

  if (!updated) throw new Error('Database connection not found');
  return redactDbPassword(updated);
}

export async function deleteDbConnection(dbId: string): Promise<void> {
  await updateStorage((current) => ({
    ...current,
    connections: {
      ...current.connections,
      db: current.connections.db.filter((item) => item.db_id !== dbId),
    },
    requests: {
      folders: current.requests.folders.filter((folder) => folder.db_id !== dbId),
      items: current.requests.items.filter((item) => item.db_id !== dbId),
    },
  }));
}
