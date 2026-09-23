export function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function comparableName(value = "") {
  return slugify(value).replaceAll("-", " ");
}

export function allocateStableSlugs(items, stableSlugs = new Map()) {
  const used = new Set();

  // Published slugs win over newly generated ones, independently of source
  // ordering. Existing collisions remain visible to validation.
  for (const item of [...items].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const stable = stableSlugs.get(item.id);
    if (!stable) continue;
    item.slug = stable;
    used.add(stable);
  }

  for (const item of [...items].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (stableSlugs.has(item.id)) continue;
    const base = item.slug || slugify(item.names?.en ?? item.names?.fr ?? item.id);
    let candidate = base;
    if (used.has(candidate)) candidate = `${base}-${slugify(item.id)}`;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${slugify(item.id)}-${suffix}`;
      suffix += 1;
    }
    item.slug = candidate;
    used.add(candidate);
  }
  return items;
}
