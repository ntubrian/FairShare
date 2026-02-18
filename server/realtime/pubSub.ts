import { PubSub } from "type-graphql";

export const expenseAddedTopic = (projectId: string) =>
  `expense.added.${projectId}`;

class InMemoryPubSub implements PubSub {
  private readonly listeners = new Map<
    string,
    Set<(payload: unknown) => void>
  >();

  publish(routingKey: string, ...args: unknown[]) {
    const payload = args.length <= 1 ? args[0] : args;
    const listeners = this.listeners.get(routingKey);
    if (!listeners || listeners.size === 0) {
      return;
    }

    for (const listener of Array.from(listeners)) {
      listener(payload);
    }
  }

  subscribe(routingKey: string, _dynamicId?: unknown): AsyncIterable<unknown> {
    const queue: unknown[] = [];
    let resolveNext: ((result: IteratorResult<unknown>) => void) | null = null;
    let closed = false;

    const listeners =
      this.listeners.get(routingKey) ?? new Set<(payload: unknown) => void>();
    const push = (payload: unknown) => {
      if (closed) {
        return;
      }

      if (resolveNext) {
        const resolver = resolveNext;
        resolveNext = null;
        resolver({ value: payload, done: false });
        return;
      }

      queue.push(payload);
    };

    listeners.add(push);
    this.listeners.set(routingKey, listeners);

    const cleanup = () => {
      if (closed) {
        return;
      }

      closed = true;
      const current = this.listeners.get(routingKey);
      if (current) {
        current.delete(push);
        if (current.size === 0) {
          this.listeners.delete(routingKey);
        }
      }
      if (resolveNext) {
        const resolver = resolveNext;
        resolveNext = null;
        resolver({ value: undefined, done: true });
      }
    };

    const iterator: AsyncIterableIterator<unknown> = {
      next: async () => {
        if (closed) {
          return { value: undefined, done: true };
        }
        if (queue.length > 0) {
          return { value: queue.shift(), done: false };
        }
        return new Promise<IteratorResult<unknown>>((resolve) => {
          resolveNext = resolve;
        });
      },
      return: async () => {
        cleanup();
        return { value: undefined, done: true };
      },
      throw: async (error: unknown) => {
        cleanup();
        throw error;
      },
      [Symbol.asyncIterator]() {
        return iterator;
      },
    };

    return iterator;
  }
}

export const graphqlPubSub = new InMemoryPubSub();
