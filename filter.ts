export function filter<T extends object>(
  obj: T,
  predicate: <K extends keyof T>(value: T[K], key: K) => boolean
) {
  const result: { [K in keyof T]?: T[K] } = {};
  (Object.keys(obj) as Array<keyof T>).forEach((name) => {
    if (predicate(obj[name], name)) {
      result[name] = obj[name];
    }
  });
  return result;
}

export function slice(text: string, length: number) {
  if (length <= 0) {
    length = text.length;
  }
  if (text.length > length) {
    return text.slice(0, length) + "...";
  }
  return text;
}