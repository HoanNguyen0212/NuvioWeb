export function catalogRequiresExtras(catalog) {
  // Catalogs that cannot be requested without extra params (required search,
  // genre, ...) belong to the search/discover screens, not the home screen.
  return Array.isArray(catalog?.extra) && catalog.extra.some((entry) => Boolean(entry?.isRequired));
}

export function buildCatalogOrderKey(addonId, type, catalogId) {
  return `${addonId}_${type}_${catalogId}`;
}

export function buildCatalogDisableKey(addonBaseUrl, type, catalogId, catalogName) {
  return `${addonBaseUrl}_${type}_${catalogId}_${catalogName}`;
}

export function buildCollectionOrderKey(collectionId) {
  const id = String(collectionId || "").trim();
  return id ? `collection_${id}` : "";
}

export function reconcileCatalogOrderWithAddonGroups(savedOrderKeys = [], addonCatalogKeyGroups = []) {
  const saved = Array.from(new Set((savedOrderKeys || []).filter(Boolean)));
  const groups = (addonCatalogKeyGroups || [])
    .map((keys) => Array.from(new Set((keys || []).filter(Boolean))))
    .filter((keys) => keys.length);
  const knownKeys = groups.flat();
  const knownSet = new Set(knownKeys);
  const savedIndex = new Map(saved.map((key, index) => [key, index]));
  const regroupedKnown = groups.flatMap((keys) =>
    [...keys].sort((left, right) => {
      const leftIndex = savedIndex.has(left) ? savedIndex.get(left) : Number.MAX_SAFE_INTEGER;
      const rightIndex = savedIndex.has(right) ? savedIndex.get(right) : Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      return knownKeys.indexOf(left) - knownKeys.indexOf(right);
    })
  );

  let nextKnownIndex = 0;
  const reconciled = saved.map((key) => {
    if (!knownSet.has(key)) {
      return key;
    }
    const replacement = regroupedKnown[nextKnownIndex] || key;
    nextKnownIndex += 1;
    return replacement;
  });
  while (nextKnownIndex < regroupedKnown.length) {
    reconciled.push(regroupedKnown[nextKnownIndex]);
    nextKnownIndex += 1;
  }
  return Array.from(new Set(reconciled));
}

export function toDisplayTypeLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function customTitleForKey(customTitles = {}, key = "") {
  return String(customTitles?.[key] || "").trim();
}

export function buildOrderedCatalogItems(
  addons,
  savedOrderKeys = [],
  disabledKeys = [],
  customTitles = {}
) {
  return buildOrderedHomeCatalogItems(addons, [], savedOrderKeys, disabledKeys, customTitles);
}

export function buildOrderedHomeCatalogItems(
  addons,
  collections = [],
  savedOrderKeys = [],
  disabledKeys = [],
  customTitles = {}
) {
  const defaultEntries = [];
  const seenKeys = new Set();
  const disabledSet = new Set(disabledKeys || []);

  (addons || []).forEach((addon) => {
    (addon.catalogs || [])
      .filter((catalog) => !catalogRequiresExtras(catalog))
      .forEach((catalog) => {
        const key = buildCatalogOrderKey(addon.id, catalog.apiType, catalog.id);
        if (seenKeys.has(key)) {
          return;
        }
        seenKeys.add(key);
        defaultEntries.push({
          key,
          disableKey: buildCatalogDisableKey(
            addon.baseUrl,
            catalog.apiType,
            catalog.id,
            catalog.name
          ),
          addonBaseUrl: addon.baseUrl,
          addonId: addon.id,
          addonName: addon.displayName,
          catalogId: catalog.id,
          catalogName: customTitleForKey(customTitles, key) || catalog.name,
          originalCatalogName: catalog.name,
          type: catalog.apiType,
          isDisabled: false
        });
      });
  });

  (collections || []).forEach((collection) => {
    const key = buildCollectionOrderKey(collection?.id);
    if (!key || seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);
    const folderCount = Array.isArray(collection?.folders) ? collection.folders.length : 0;
    defaultEntries.push({
      key,
      disableKey: key,
      addonBaseUrl: "",
      addonId: "",
      addonName: folderCount === 1 ? "1 folder" : `${folderCount} folders`,
      catalogId: collection.id,
      catalogName: customTitleForKey(customTitles, key) || collection.title,
      originalCatalogName: collection.title,
      type: "collection",
      isCollection: true,
      collectionId: collection.id,
      isDisabled: false
    });
  });

  const entryByKey = new Map(defaultEntries.map((entry) => [entry.key, entry]));
  const defaultOrderKeys = defaultEntries.map((entry) => entry.key);
  const savedValid = (savedOrderKeys || []).filter(
    (key, index, array) => array.indexOf(key) === index && entryByKey.has(key)
  );
  const savedSet = new Set(savedValid);
  const effectiveOrder = [...savedValid, ...defaultOrderKeys.filter((key) => !savedSet.has(key))];

  function isEntryDisabled(entry) {
    return disabledSet.has(entry.disableKey) || disabledSet.has(entry.key);
  }

  return effectiveOrder
    .map((key) => entryByKey.get(key))
    .filter(Boolean)
    .map((entry, index, array) => ({
      ...entry,
      disableKey:
        disabledSet.has(entry.key) && !disabledSet.has(entry.disableKey)
          ? entry.key
          : entry.disableKey,
      isDisabled: isEntryDisabled(entry),
      canMoveUp: index > 0,
      canMoveDown: index < array.length - 1
    }));
}
