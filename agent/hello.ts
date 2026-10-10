// Placeholder so the type check, lint and test commands have something to run.
// Delete this file and its test when the first real code is added.

// Takes the first service name from a list and returns it in capital letters.
export function firstServiceUpperCase(services: string[], fallback = 'UNKNOWN'): string | undefined {
  const first = services[0];
  if(!first) return fallback;
  return first.toUpperCase();
}

export function loadServices(): string[] {
  return ["cart"];
}

export function printFirst() {
  const services = loadServices();
  console.log(services);
}