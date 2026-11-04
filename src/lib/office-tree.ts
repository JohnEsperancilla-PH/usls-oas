// Orders offices so each sub-office follows its main office, for office pickers and lists.

interface TreeOffice {
  id: string;
  name: string;
  category?: string | null;
  parent_office_id?: string | null;
}

export interface OfficeTreeEntry<T extends TreeOffice> {
  office: T;
  // Set for sub-offices whose main office is in the list.
  parent: T | null;
}

export function orderOfficesAsTree<T extends TreeOffice>(offices: T[]): OfficeTreeEntry<T>[] {
  const byId = new Map(offices.map((office) => [office.id, office]));
  const children = new Map<string, T[]>();
  const roots: T[] = [];
  for (const office of offices) {
    const parent = office.parent_office_id ? byId.get(office.parent_office_id) : undefined;
    if (parent) children.set(parent.id, [...(children.get(parent.id) || []), office]);
    else roots.push(office);
  }
  return roots.flatMap((root) => [
    { office: root, parent: null },
    ...(children.get(root.id) || []).map((child) => ({ office: child, parent: root })),
  ]);
}

// Dropdown label: sub-offices are marked so they read as part of the main office above them.
export function officeOptionLabel<T extends TreeOffice>(entry: OfficeTreeEntry<T>): string {
  return entry.parent ? `↳ ${entry.office.name} (${entry.parent.name})` : entry.office.name;
}

// Sub-offices without their own category are grouped with their main office.
export function effectiveCategory<T extends TreeOffice>(office: T, offices: T[]): string | null {
  if (office.category) return office.category;
  const parent = office.parent_office_id ? offices.find((o) => o.id === office.parent_office_id) : undefined;
  return parent?.category || null;
}
